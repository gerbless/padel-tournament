import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Not } from 'typeorm';
import { MercadoPagoPayment, MercadoPagoPaymentStatus } from './entities/mercadopago-payment.entity';
import { Reservation, PaymentStatus, ReservationStatus } from '../courts/entities/reservation.entity';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { randomUUID } from 'crypto';
import { EmailService } from '../email/email.service';

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PaymentsService.name);
    private mpClient: MercadoPagoConfig | null = null;
    private preferenceClient: Preference | null = null;
    private paymentClient: Payment | null = null;
    private expirationInterval: any;
    private readonly paymentExpiryMs: number;

    constructor(
        private configService: ConfigService,
        @InjectRepository(MercadoPagoPayment)
        private mpPaymentRepo: Repository<MercadoPagoPayment>,
        @InjectRepository(Reservation)
        private reservationRepo: Repository<Reservation>,
        private emailService: EmailService,
    ) {
        const accessToken = this.configService.get<string>('MP_ACCESS_TOKEN', '');
        const expirySeconds = this.configService.get<number>('PAYMENT_EXPIRY_SECONDS', 60);
        this.paymentExpiryMs = expirySeconds * 1000;

        this.logger.log('=== MERCADO PAGO CONFIG ===');
        this.logger.log(`MP_ACCESS_TOKEN: ${accessToken ? accessToken.substring(0, 10) + '***' : '(vacío)'}`);
        this.logger.log(`MP_PUBLIC_KEY: ${this.configService.get<string>('MP_PUBLIC_KEY', '(vacío)').substring(0, 10)}***`);
        this.logger.log(`PAYMENT_EXPIRY_SECONDS: ${expirySeconds}`);

        if (accessToken) {
            this.mpClient = new MercadoPagoConfig({ accessToken });
            this.preferenceClient = new Preference(this.mpClient);
            this.paymentClient = new Payment(this.mpClient);
            this.logger.log('✅ Mercado Pago client configured');
        } else {
            this.logger.warn('⚠️ MP_ACCESS_TOKEN no configurado – pagos no disponibles');
        }
    }

    onModuleInit() {
        // Check for expired payment deadlines every 10 seconds
        this.expirationInterval = setInterval(() => this.cancelExpiredReservations(), 10_000);
        this.logger.log('⏰ Payment expiration checker started (every 10s)');
    }

    onModuleDestroy() {
        if (this.expirationInterval) {
            clearInterval(this.expirationInterval);
        }
    }

    /**
     * Cancel reservations whose payment deadline has expired.
     * Skips reservations whose MP payment has statusDetail = 'pending_contingency'
     * (MP is still reviewing the payment).
     */
    private async cancelExpiredReservations(): Promise<void> {
        try {
            const now = new Date();
            const expired = await this.reservationRepo.find({
                where: {
                    paymentExpiresAt: LessThanOrEqual(now),
                    status: Not(ReservationStatus.CANCELLED as any),
                    paymentStatus: Not(PaymentStatus.PAID as any),
                },
            });

            for (const reservation of expired) {
                // Check if there's a pending_contingency MP payment — if so, skip
                const mpPayment = await this.mpPaymentRepo.findOne({
                    where: { reservationId: reservation.id },
                    order: { createdAt: 'DESC' },
                });
                if (mpPayment?.statusDetail === 'pending_contingency') {
                    // Clear the deadline so we don't keep checking this one
                    await this.reservationRepo.update(reservation.id, { paymentExpiresAt: null });
                    this.logger.log(`⏳ Reservation ${reservation.id} has pending_contingency – skipping auto-cancel`);
                    continue;
                }

                this.logger.log(`⏰ Auto-cancelling reservation ${reservation.id} – payment deadline expired`);
                await this.reservationRepo.remove(reservation);
                this.logger.log(`🗑️  Deleted reservation ${reservation.id} and its payment records`);
            }
        } catch (error) {
            this.logger.error(`Error in cancelExpiredReservations: ${error.message}`);
        }
    }

    /**
     * Get MP public key for frontend
     */
    getPublicKey(): { publicKey: string; configured: boolean; paymentExpirySeconds: number } {
        const publicKey = this.configService.get<string>('MP_PUBLIC_KEY', '');
        return {
            publicKey,
            configured: !!this.mpClient,
            paymentExpirySeconds: this.paymentExpiryMs / 1000,
        };
    }

    /**
     * Create a checkout preference for a reservation
     */
    async createPreference(reservationId: string, payerEmail?: string): Promise<{
        preferenceId: string;
        initPoint: string;
        externalReference: string;
    }> {
        if (!this.preferenceClient) {
            throw new BadRequestException('Mercado Pago no está configurado. Contacte al administrador.');
        }

        const reservation = await this.reservationRepo.findOne({
            where: { id: reservationId },
            relations: ['court'],
        });
        if (!reservation) {
            throw new NotFoundException('Reserva no encontrada');
        }

        if (reservation.paymentStatus === PaymentStatus.PAID) {
            throw new BadRequestException('Esta reserva ya está pagada');
        }

        // Reuse existing pending/rejected payment record for this reservation
        const existingPayment = await this.mpPaymentRepo.findOne({
            where: { reservationId },
            order: { createdAt: 'DESC' },
        });

        // If there's an existing record with a valid preference and it's not in a terminal approved state,
        // reuse it instead of creating a new one
        if (existingPayment && existingPayment.preferenceId &&
            existingPayment.status !== MercadoPagoPaymentStatus.APPROVED) {
            this.logger.log(`Reusing existing preference ${existingPayment.preferenceId} for reservation ${reservationId}`);

            // Update payer email if provided
            if (payerEmail && existingPayment.payerEmail !== payerEmail) {
                existingPayment.payerEmail = payerEmail;
                await this.mpPaymentRepo.save(existingPayment);
            }

            // Reset status back to pending for retry
            if (existingPayment.status !== MercadoPagoPaymentStatus.PENDING) {
                existingPayment.status = MercadoPagoPaymentStatus.PENDING;
                await this.mpPaymentRepo.save(existingPayment);
            }

            // Reset payment deadline
            await this.reservationRepo.update(reservationId, {
                paymentExpiresAt: new Date(Date.now() + this.paymentExpiryMs),
            });

            return {
                preferenceId: existingPayment.preferenceId,
                initPoint: `https://www.mercadopago.cl/checkout/v1/redirect?pref_id=${existingPayment.preferenceId}`,
                externalReference: existingPayment.externalReference,
            };
        }

        const externalReference = `res_${reservationId}_${randomUUID().substring(0, 8)}`;
        const amount = Number(reservation.finalPrice);
        const appUrl = this.configService.get<string>('APP_URL', 'http://localhost');
        const backendUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:3000');

        const courtName = reservation.court?.name || 'Cancha';
        const description = `Reserva ${courtName} - ${reservation.date} ${reservation.startTime}-${reservation.endTime}`;

        this.logger.log(`Creating NEW preference for reservation ${reservationId}, amount: ${amount}, ref: ${externalReference}`);

        try {
            const preferenceResponse = await this.preferenceClient.create({
                body: {
                    items: [
                        {
                            id: reservationId,
                            title: description,
                            quantity: 1,
                            unit_price: amount,
                            currency_id: 'CLP',
                        },
                    ],
                    payer: payerEmail ? { email: payerEmail } : undefined,
                    external_reference: externalReference,
                    back_urls: {
                        success: `${appUrl}/player/my-bookings?payment=success&rid=${reservationId}`,
                        failure: `${appUrl}/player/my-bookings?payment=failure&rid=${reservationId}`,
                        pending: `${appUrl}/player/my-bookings?payment=pending&rid=${reservationId}`,
                    },
                    auto_return: 'approved',
                    notification_url: `${backendUrl}/api/payments/webhook`,
                    statement_descriptor: 'PADEL MGR',
                },
            });

            // If there's an old record (e.g. cancelled), update it instead of creating new
            if (existingPayment) {
                existingPayment.preferenceId = preferenceResponse.id;
                existingPayment.externalReference = externalReference;
                existingPayment.amount = amount;
                existingPayment.description = description;
                existingPayment.payerEmail = payerEmail || existingPayment.payerEmail;
                existingPayment.status = MercadoPagoPaymentStatus.PENDING;
                existingPayment.mpPaymentId = null;
                existingPayment.mpData = null;
                existingPayment.statusDetail = null;
                existingPayment.paymentMethod = null;
                await this.mpPaymentRepo.save(existingPayment);
                this.logger.log(`✅ Updated existing payment record with new preference: ${preferenceResponse.id}`);
            } else {
                // First time — create new record
                const mpPayment = this.mpPaymentRepo.create({
                    reservationId,
                    clubId: reservation.clubId,
                    preferenceId: preferenceResponse.id,
                    externalReference,
                    amount,
                    description,
                    payerEmail: payerEmail || null,
                    status: MercadoPagoPaymentStatus.PENDING,
                });
                await this.mpPaymentRepo.save(mpPayment);
                this.logger.log(`✅ Created new payment record with preference: ${preferenceResponse.id}`);
            }

            // Set payment deadline
            await this.reservationRepo.update(reservationId, {
                paymentExpiresAt: new Date(Date.now() + this.paymentExpiryMs),
            });

            return {
                preferenceId: preferenceResponse.id,
                initPoint: preferenceResponse.init_point,
                externalReference,
            };
        } catch (error) {
            this.logger.error(`❌ Error creating preference: ${error.message}`);
            throw new BadRequestException(`Error al crear preferencia de pago: ${error.message}`);
        }
    }

    /**
     * Create a payment link for billing (admin sends to player)
     */
    async createPaymentLink(reservationId: string): Promise<{ paymentUrl: string }> {
        const result = await this.createPreference(reservationId);
        return { paymentUrl: result.initPoint };
    }

    /**
     * Handle Mercado Pago webhook notification
     */
    async handleWebhook(body: any, query: any): Promise<void> {
        this.logger.log(`Webhook received: type=${body.type || query.type}, action=${body.action}`);
        this.logger.log(`Webhook body: ${JSON.stringify(body).substring(0, 500)}`);

        // MP sends payment notifications with type=payment or topic=payment
        const paymentId = body.data?.id || query['data.id'];
        const topic = body.type || query.topic;

        if (!paymentId || (topic !== 'payment' && body.action !== 'payment.created' && body.action !== 'payment.updated')) {
            this.logger.log('Webhook ignored – not a payment notification');
            return;
        }

        if (!this.paymentClient) {
            this.logger.error('Payment client not configured – cannot process webhook');
            return;
        }

        try {
            // Fetch payment details from MP
            const mpPayment = await this.paymentClient.get({ id: Number(paymentId) });
            const externalReference = mpPayment.external_reference;
            const status = mpPayment.status; // approved, pending, rejected, etc.
            const statusDetail = mpPayment.status_detail;

            this.logger.log(`Payment ${paymentId}: status=${status}, detail=${statusDetail}, ref=${externalReference}`);

            // Find our payment record
            const payment = await this.mpPaymentRepo.findOne({
                where: { externalReference },
            });

            if (!payment) {
                this.logger.warn(`Payment record not found for external_reference: ${externalReference}`);
                return;
            }

            // Update payment record
            payment.mpPaymentId = String(paymentId);
            payment.status = this.mapMpStatus(status);
            payment.statusDetail = statusDetail;
            payment.paymentMethod = mpPayment.payment_method_id || null;
            payment.mpData = mpPayment;
            await this.mpPaymentRepo.save(payment);

            // If approved, update reservation payment status and send confirmation email
            if (status === 'approved') {
                this.logger.log(`✅ Payment approved for reservation ${payment.reservationId}`);
                await this.reservationRepo.update(payment.reservationId, {
                    paymentStatus: PaymentStatus.PAID,
                    paymentNotes: `Pagado via Mercado Pago (ID: ${paymentId})`,
                    paymentExpiresAt: null, // Clear deadline
                });
                // Send confirmation email
                await this.sendPaymentConfirmationEmail(payment.reservationId, String(paymentId), payment.payerEmail);
            } else if (statusDetail === 'pending_contingency') {
                this.logger.log(`⏳ Payment pending_contingency for reservation ${payment.reservationId} – clearing deadline`);
                await this.reservationRepo.update(payment.reservationId, {
                    paymentExpiresAt: null, // Don't auto-cancel while MP is reviewing
                });
            } else if (status === 'rejected') {
                // Just log – let the timer handle deletion so the user can retry
                this.logger.log(`❌ Payment rejected for reservation ${payment.reservationId} – waiting for timer to expire`);
            } else if (status === 'cancelled') {
                this.logger.log(`❌ Payment cancelled for reservation ${payment.reservationId} – deleting reservation`);
                const reservation = await this.reservationRepo.findOne({ where: { id: payment.reservationId } });
                if (reservation) {
                    await this.reservationRepo.remove(reservation);
                    this.logger.log(`🗑️ Deleted reservation ${payment.reservationId} and its payment records`);
                }
            }
        } catch (error) {
            this.logger.error(`Error processing webhook: ${error.message}`);
        }
    }

    /**
     * Sync payment status from MP API (called when user returns from checkout)
     */
    async syncPaymentStatus(reservationId: string): Promise<{ status: string; synced: boolean }> {
        const payment = await this.mpPaymentRepo.findOne({
            where: { reservationId },
            order: { createdAt: 'DESC' },
        });

        if (!payment) {
            return { status: 'no_payment', synced: false };
        }

        // If already approved, no need to sync
        if (payment.status === MercadoPagoPaymentStatus.APPROVED) {
            return { status: 'approved', synced: false };
        }

        // Search for payments by external_reference via MP API
        if (!this.paymentClient) {
            return { status: payment.status, synced: false };
        }

        try {
            // Use the MP Payment Search API
            const searchResponse = await fetch(
                `https://api.mercadopago.com/v1/payments/search?external_reference=${payment.externalReference}&sort=date_created&criteria=desc`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.configService.get<string>('MP_ACCESS_TOKEN')}`,
                    },
                }
            );
            const searchData = await searchResponse.json();

            if (searchData.results && searchData.results.length > 0) {
                const mpPayment = searchData.results[0];
                const mpStatus = mpPayment.status;

                this.logger.log(`Sync: Payment ${mpPayment.id} for ref ${payment.externalReference} status=${mpStatus}`);

                // Update our record
                payment.mpPaymentId = String(mpPayment.id);
                payment.status = this.mapMpStatus(mpStatus);
                payment.statusDetail = mpPayment.status_detail;
                payment.paymentMethod = mpPayment.payment_method_id || null;
                payment.mpData = mpPayment;
                await this.mpPaymentRepo.save(payment);

                // If approved, update reservation and send confirmation email
                if (payment.reservationId) {
                    if (mpStatus === 'approved') {
                        await this.reservationRepo.update(payment.reservationId, {
                            paymentStatus: PaymentStatus.PAID,
                            paymentNotes: `Pagado via Mercado Pago (ID: ${mpPayment.id})`,
                            paymentExpiresAt: null, // Clear deadline
                        });
                        this.logger.log(`✅ Reservation ${payment.reservationId} marked as PAID via sync`);
                        // Send confirmation email
                        await this.sendPaymentConfirmationEmail(payment.reservationId, String(mpPayment.id), payment.payerEmail);
                    } else if (mpPayment.status_detail === 'pending_contingency') {
                        this.logger.log(`⏳ Payment pending_contingency for reservation ${payment.reservationId} via sync – clearing deadline`);
                        await this.reservationRepo.update(payment.reservationId, {
                            paymentExpiresAt: null,
                        });
                    } else if (mpStatus === 'rejected') {
                        // Just log – let the timer handle deletion so the user can retry
                        this.logger.log(`❌ Payment rejected for reservation ${payment.reservationId} via sync – waiting for timer`);
                    } else if (mpStatus === 'cancelled') {
                        this.logger.log(`❌ Payment cancelled for reservation ${payment.reservationId} via sync – deleting reservation`);
                        const reservation = await this.reservationRepo.findOne({ where: { id: payment.reservationId } });
                        if (reservation) {
                            await this.reservationRepo.remove(reservation);
                            this.logger.log(`🗑️ Deleted reservation ${payment.reservationId} and its payment records`);
                        }
                    }
                }

                return { status: mpStatus, synced: true };
            }
        } catch (error) {
            this.logger.error(`Error syncing payment: ${error.message}`);
        }

        return { status: payment.status, synced: false };
    }

    /**
     * Get payment status for a reservation
     */
    async getPaymentStatus(reservationId: string): Promise<MercadoPagoPayment | null> {
        return this.mpPaymentRepo.findOne({
            where: { reservationId },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Get all payments for a club
     */
    async getClubPayments(clubId: string, limit = 50): Promise<MercadoPagoPayment[]> {
        return this.mpPaymentRepo.find({
            where: { clubId },
            order: { createdAt: 'DESC' },
            take: limit,
            relations: ['reservation'],
        });
    }

    /**
     * Load reservation with court and send payment confirmation email
     */
    private async sendPaymentConfirmationEmail(reservationId: string, mpPaymentId: string, payerEmail?: string): Promise<void> {
        try {
            const reservation = await this.reservationRepo.findOne({
                where: { id: reservationId },
                relations: ['court'],
            });
            if (!reservation) {
                this.logger.warn(`Cannot send confirmation email: reservation ${reservationId} not found`);
                return;
            }

            const email = payerEmail;
            if (!email) {
                this.logger.warn(`Cannot send confirmation email: no payer email for reservation ${reservationId}`);
                return;
            }

            await this.emailService.sendPaymentConfirmationEmail(
                email,
                {
                    date: reservation.date,
                    startTime: reservation.startTime,
                    endTime: reservation.endTime,
                    courtName: reservation.court?.name || 'Cancha',
                    finalPrice: Number(reservation.finalPrice),
                },
                mpPaymentId,
            );
        } catch (error) {
            this.logger.error(`Error sending payment confirmation email: ${error.message}`);
        }
    }

    private mapMpStatus(mpStatus: string): MercadoPagoPaymentStatus {
        switch (mpStatus) {
            case 'approved': return MercadoPagoPaymentStatus.APPROVED;
            case 'pending': case 'in_process': return MercadoPagoPaymentStatus.IN_PROCESS;
            case 'rejected': return MercadoPagoPaymentStatus.REJECTED;
            case 'cancelled': return MercadoPagoPaymentStatus.CANCELLED;
            case 'refunded': return MercadoPagoPaymentStatus.REFUNDED;
            default: return MercadoPagoPaymentStatus.PENDING;
        }
    }
}
