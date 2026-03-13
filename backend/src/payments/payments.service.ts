import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Not, QueryRunner } from 'typeorm';
import { MercadoPagoPayment, MercadoPagoPaymentStatus } from './entities/mercadopago-payment.entity';
import { Reservation, PaymentStatus, PaymentMethod, ReservationStatus } from '../courts/entities/reservation.entity';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { randomUUID } from 'crypto';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClubCredentialsService } from '../clubs/club-credentials.service';
import { Club } from '../clubs/entities/club.entity';
import { TenantService } from '../tenant/tenant.service';

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
        @InjectRepository(Club)
        private clubRepo: Repository<Club>,
        private emailService: EmailService,
        private notificationsService: NotificationsService,
        private credentialsService: ClubCredentialsService,
        private tenant: TenantService,
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
     * Return Mercado Pago clients for a specific club.
     * Falls back to the globally configured client if no per-club credentials exist.
     */
    private async getMpClientsForClub(clubId?: string): Promise<{
        preferenceClient: Preference | null;
        paymentClient: Payment | null;
    }> {
        const creds = await this.credentialsService.getEffectiveMpCreds(clubId);
        if (creds?.accessToken) {
            const client = new MercadoPagoConfig({ accessToken: creds.accessToken });
            return {
                preferenceClient: new Preference(client),
                paymentClient: new Payment(client),
            };
        }
        // Fall back to global env-var client
        return {
            preferenceClient: this.preferenceClient,
            paymentClient: this.paymentClient,
        };
    }

    /**
     * Cancel reservations whose payment deadline has expired.
     * Iterates over ALL active clubs since this runs in a background
     * interval with no HTTP request context.
     */
    private async cancelExpiredReservations(): Promise<void> {
        try {
            // Get all active clubs with schemas
            const clubs: { id: string }[] = await this.clubRepo.query(
                'SELECT id FROM clubs WHERE "schemaName" IS NOT NULL AND "isActive" = true',
            );

            for (const club of clubs) {
                await this.cancelExpiredForClub(club.id);
            }
        } catch (error) {
            this.logger.error(`Error in cancelExpiredReservations: ${error.message}`);
        }
    }

    /**
     * Cancel expired reservations for a single club within its schema context.
     */
    private async cancelExpiredForClub(clubId: string): Promise<void> {
        try {
            await this.tenant.run(clubId, async (em) => {
                const now = new Date();
                const reservationRepo = em.getRepository(Reservation);
                const mpRepo = em.getRepository(MercadoPagoPayment);

                const expired = await reservationRepo.find({
                    where: {
                        paymentExpiresAt: LessThanOrEqual(now),
                        status: Not(ReservationStatus.CANCELLED as any),
                        paymentStatus: Not(PaymentStatus.PAID as any),
                    },
                });

                for (const reservation of expired) {
                    // Check if any player has already paid — if so, never auto-cancel
                    if (reservation.playerPayments?.some(p => p.paid)) {
                        await reservationRepo.update(reservation.id, { paymentExpiresAt: null });
                        this.logger.log(`💰 Reservation ${reservation.id} has partial player payments – skipping auto-cancel`);
                        continue;
                    }

                    // Check if there's a pending_contingency MP payment — if so, skip
                    const mpPayment = await mpRepo.findOne({
                        where: { reservationId: reservation.id },
                        order: { createdAt: 'DESC' },
                    });
                    if (mpPayment?.statusDetail === 'pending_contingency') {
                        await reservationRepo.update(reservation.id, { paymentExpiresAt: null });
                        this.logger.log(`⏳ Reservation ${reservation.id} has pending_contingency – skipping auto-cancel`);
                        continue;
                    }

                    // Also check if any MP payment for this reservation is approved
                    const approvedPayment = await mpRepo.findOne({
                        where: { reservationId: reservation.id, status: MercadoPagoPaymentStatus.APPROVED },
                    });
                    if (approvedPayment) {
                        await reservationRepo.update(reservation.id, { paymentExpiresAt: null });
                        this.logger.log(`💰 Reservation ${reservation.id} has an approved payment – skipping auto-cancel`);
                        continue;
                    }

                    this.logger.log(`⏰ Auto-cancelling reservation ${reservation.id} – payment deadline expired`);
                    await reservationRepo.remove(reservation);
                    this.logger.log(`🗑️  Deleted reservation ${reservation.id} and its payment records`);
                }
            });
        } catch (error) {
            this.logger.error(`Error cancelling expired reservations for club ${clubId}: ${error.message}`);
        }
    }

    /**
     * Get MP public key for frontend.
     * If clubId is provided and the club has enablePayments=false, returns configured:false
     * even when global MP credentials are set.
     */
    async getPublicKey(clubId?: string): Promise<{ publicKey: string; configured: boolean; paymentExpirySeconds: number }> {
        const publicKey = this.configService.get<string>('MP_PUBLIC_KEY', '');
        let configured = !!this.mpClient;

        if (configured && clubId) {
            try {
                const club = await this.clubRepo.findOne({ where: { id: clubId } });
                if (club && club.enablePayments === false) {
                    configured = false;
                }
            } catch { /* ignore — default to global configured state */ }
        }

        return {
            publicKey,
            configured,
            paymentExpirySeconds: this.paymentExpiryMs / 1000,
        };
    }

    /**
     * Create a checkout preference for a reservation.
     * Uses a DEDICATED QueryRunner (isolated from the interceptor's QR)
     * so the search_path is guaranteed throughout the entire operation.
     */
    async createPreference(reservationId: string, payerEmail?: string, clubId?: string): Promise<{
        preferenceId: string;
        initPoint: string;
        externalReference: string;
    }> {
        // Resolve clubId and create an isolated QR with the correct search_path
        const cid = clubId || this.tenant.getCurrentClubId();
        if (!cid) {
            throw new BadRequestException('Se requiere contexto de club para crear preferencia de pago.');
        }

        const qr = await this.tenant.createQueryRunner(cid);
        try {
            return await this._createPreferenceWithQR(qr, reservationId, payerEmail);
        } finally {
            await qr.query('SET search_path TO public').catch(() => {});
            await qr.release();
        }
    }

    /**
     * Internal: runs createPreference logic using the provided QueryRunner.
     */
    private async _createPreferenceWithQR(
        qr: QueryRunner,
        reservationId: string,
        payerEmail?: string,
    ): Promise<{
        preferenceId: string;
        initPoint: string;
        externalReference: string;
    }> {
        const reservationRepo = qr.manager.getRepository(Reservation);
        const mpRepo = qr.manager.getRepository(MercadoPagoPayment);

        const reservation = await reservationRepo.findOne({
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
        const existingPayment = await mpRepo.findOne({
            where: { reservationId },
            order: { createdAt: 'DESC' },
        });

        // If there's an existing record with a valid preference and it's not in a terminal approved state,
        // reuse it instead of creating a new one
        if (existingPayment && existingPayment.preferenceId &&
            existingPayment.status !== MercadoPagoPaymentStatus.APPROVED) {
            this.logger.log(`Reusing existing preference ${existingPayment.preferenceId} for reservation ${reservationId}`);

            // Update payer email and/or status if needed
            const patchFields: Partial<MercadoPagoPayment> = {};
            if (payerEmail && existingPayment.payerEmail !== payerEmail) {
                patchFields.payerEmail = payerEmail;
            }
            if (existingPayment.status !== MercadoPagoPaymentStatus.PENDING) {
                patchFields.status = MercadoPagoPaymentStatus.PENDING;
            }
            if (Object.keys(patchFields).length > 0) {
                await mpRepo.update(existingPayment.id, patchFields);
            }

            // Reset payment deadline
            await reservationRepo.update(reservationId, {
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

        // Resolve per-club MP client (falls back to global)
        const { preferenceClient: clubPreferenceClient } = await this.getMpClientsForClub(reservation.clubId);
        if (!clubPreferenceClient) {
            throw new BadRequestException('Mercado Pago no está configurado. Contacte al administrador.');
        }

        try {
            const preferenceResponse = await clubPreferenceClient.create({
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
                    notification_url: `${backendUrl}/api/payments/webhook${reservation.clubId ? `?clubId=${reservation.clubId}` : ''}`,
                    statement_descriptor: 'Agon Padel',
                },
            });

            // If there's an old record (e.g. cancelled), update it instead of creating new
            if (existingPayment) {
                await mpRepo.update(existingPayment.id, {
                    preferenceId: preferenceResponse.id,
                    externalReference,
                    amount,
                    description,
                    payerEmail: payerEmail || existingPayment.payerEmail,
                    status: MercadoPagoPaymentStatus.PENDING,
                    mpPaymentId: null,
                    mpData: null,
                    statusDetail: null,
                    paymentMethod: null,
                });
                this.logger.log(`✅ Updated existing payment record with new preference: ${preferenceResponse.id}`);
            } else {
                // First time — insert new record
                await mpRepo.insert({
                    reservationId,
                    clubId: reservation.clubId,
                    preferenceId: preferenceResponse.id,
                    externalReference,
                    amount,
                    description,
                    payerEmail: payerEmail || null,
                    status: MercadoPagoPaymentStatus.PENDING,
                });
                this.logger.log(`✅ Created new payment record with preference: ${preferenceResponse.id}`);
            }

            // Set payment deadline
            await reservationRepo.update(reservationId, {
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
    async createPaymentLink(reservationId: string): Promise<{ paymentUrl: string; shortUrl: string }> {
        const result = await this.createPreference(reservationId);
        const shortUrl = await this.shortenUrl(result.initPoint);
        return { paymentUrl: result.initPoint, shortUrl };
    }

    /**
     * Create a payment link for a single player (on-demand, by player index).
     * Works regardless of priceType — uses the player name from reservation.players[].
     * If playerPayments exists, uses the configured amount; otherwise splits finalPrice evenly.
     */
    async createSinglePlayerLink(
        reservationId: string,
        playerIndex: number,
    ): Promise<{ playerIndex: number; playerName: string; amount: number; paymentUrl: string; shortUrl: string; status: string }> {
        const reservation = await this.tenant.getRepo(Reservation).findOne({
            where: { id: reservationId },
            relations: ['court'],
        });
        if (!reservation) {
            throw new NotFoundException('Reserva no encontrada');
        }

        const players = reservation.players || [];
        if (playerIndex < 0 || playerIndex >= players.length) {
            throw new BadRequestException(`Jugador con índice ${playerIndex} no existe en esta reserva`);
        }

        const playerName = players[playerIndex];
        if (!playerName || !playerName.trim()) {
            throw new BadRequestException('El jugador no tiene nombre asignado');
        }

        // Get playerId from playerPayments if available
        const playerIdFromPP = reservation.playerPayments?.[playerIndex]?.playerId || null;

        // Determine amount: from playerPayments if exists, otherwise split evenly
        let amount: number;
        const pp = reservation.playerPayments?.[playerIndex];
        if (pp) {
            if (pp.paid) {
                return {
                    playerIndex, playerName, amount: Number(pp.amount),
                    paymentUrl: '', shortUrl: '', status: 'paid',
                };
            }
            amount = Number(pp.amount);
        } else {
            const filledPlayers = players.filter(p => p.trim()).length || 1;
            amount = Math.round(((Number(reservation.finalPrice) || 0) / filledPlayers) * 100) / 100;
        }

        if (amount <= 0) {
            throw new BadRequestException('El monto del jugador debe ser mayor a 0');
        }

        // Check for existing pending payment for this player
        const existingPayment = await this.tenant.getRepo(MercadoPagoPayment).findOne({
            where: { reservationId, playerIndex },
            order: { createdAt: 'DESC' },
        });

        if (existingPayment && existingPayment.preferenceId &&
            existingPayment.status !== MercadoPagoPaymentStatus.APPROVED &&
            existingPayment.status !== MercadoPagoPaymentStatus.REJECTED &&
            existingPayment.status !== MercadoPagoPaymentStatus.CANCELLED) {
            const paymentUrl = `https://www.mercadopago.cl/checkout/v1/redirect?pref_id=${existingPayment.preferenceId}`;
            const shortUrl = await this.shortenUrl(paymentUrl);
            return { playerIndex, playerName, amount, paymentUrl, shortUrl, status: existingPayment.status };
        }

        const appUrl = this.configService.get<string>('APP_URL', 'http://localhost');
        const backendUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:3000');
        const courtName = reservation.court?.name || 'Cancha';
        const externalReference = `res_${reservationId}_p${playerIndex}_${randomUUID().substring(0, 8)}`;
        const description = `${playerName} - ${courtName} - ${reservation.date} ${reservation.startTime}-${reservation.endTime}`;

        // Resolve per-club MP client (falls back to global)
        const { preferenceClient: clubPreferenceClient } = await this.getMpClientsForClub(reservation.clubId);
        if (!clubPreferenceClient) {
            throw new BadRequestException('Mercado Pago no está configurado. Contacte al administrador.');
        }

        try {
            const preferenceResponse = await clubPreferenceClient.create({
                body: {
                    items: [{
                        id: `${reservationId}_p${playerIndex}`,
                        title: description,
                        quantity: 1,
                        unit_price: amount,
                        currency_id: 'CLP',
                    }],
                    external_reference: externalReference,
                    back_urls: {
                        success: `${appUrl}/player/my-bookings?payment=success&rid=${reservationId}`,
                        failure: `${appUrl}/player/my-bookings?payment=failure&rid=${reservationId}`,
                        pending: `${appUrl}/player/my-bookings?payment=pending&rid=${reservationId}`,
                    },
                    auto_return: 'approved',
                    notification_url: `${backendUrl}/api/payments/webhook${reservation.clubId ? `?clubId=${reservation.clubId}` : ''}`,
                    statement_descriptor: 'Agon Padel',
                },
            });

            // Ensure playerPayments entry exists on the reservation
            if (!reservation.playerPayments) {
                reservation.playerPayments = [];
            }
            const existingPP = reservation.playerPayments[playerIndex];
            if (!existingPP) {
                reservation.playerPayments.push({ playerName, paid: false, amount });
                await this.tenant.getRepo(Reservation).update(reservationId, {
                    playerPayments: reservation.playerPayments,
                });
            }

            // Create or update payment record
            if (existingPayment) {
                await this.tenant.getRepo(MercadoPagoPayment).update(existingPayment.id, {
                    preferenceId: preferenceResponse.id,
                    externalReference,
                    amount,
                    description,
                    status: MercadoPagoPaymentStatus.PENDING,
                    mpPaymentId: null,
                    mpData: null,
                    statusDetail: null,
                    paymentMethod: null,
                });
            } else {
                await this.tenant.getRepo(MercadoPagoPayment).insert({
                    reservationId, clubId: reservation.clubId,
                    preferenceId: preferenceResponse.id, externalReference,
                    amount, description, playerIndex, playerName,
                    playerId: playerIdFromPP,
                    status: MercadoPagoPaymentStatus.PENDING,
                });
            }

            const paymentUrl = preferenceResponse.init_point;
            const shortUrl = await this.shortenUrl(paymentUrl);
            return { playerIndex, playerName, amount, paymentUrl, shortUrl, status: 'pending' };
        } catch (error) {
            this.logger.error(`❌ Error creating single player link for ${playerName}: ${error.message}`);
            throw new BadRequestException(`Error al generar link para ${playerName}: ${error.message}`);
        }
    }

    /**
     * Create per-player payment links for a reservation with per_player pricing
     */
    async createPerPlayerPaymentLinks(reservationId: string): Promise<{
        links: { playerIndex: number; playerName: string; amount: number; paymentUrl: string; shortUrl: string; status: string }[];
    }> {
        const reservation = await this.tenant.getRepo(Reservation).findOne({
            where: { id: reservationId },
            relations: ['court'],
        });
        if (!reservation) {
            throw new NotFoundException('Reserva no encontrada');
        }

        if (!reservation.playerPayments || reservation.playerPayments.length === 0) {
            throw new BadRequestException('Esta reserva no tiene pagos por jugador configurados');
        }

        const appUrl = this.configService.get<string>('APP_URL', 'http://localhost');
        const backendUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:3000');
        const courtName = reservation.court?.name || 'Cancha';

        // Resolve per-club MP client once for the whole loop
        const { preferenceClient: clubPreferenceClient } = await this.getMpClientsForClub(reservation.clubId);
        if (!clubPreferenceClient) {
            throw new BadRequestException('Mercado Pago no está configurado. Contacte al administrador.');
        }

        const links: { playerIndex: number; playerName: string; amount: number; paymentUrl: string; shortUrl: string; status: string }[] = [];

        for (let i = 0; i < reservation.playerPayments.length; i++) {
            const pp = reservation.playerPayments[i];

            // Skip already paid players
            if (pp.paid) {
                links.push({
                    playerIndex: i,
                    playerName: pp.playerName,
                    amount: Number(pp.amount),
                    paymentUrl: '',
                    shortUrl: '',
                    status: 'paid',
                });
                continue;
            }

            // Check for existing payment record for this player
            const existingPayment = await this.tenant.getRepo(MercadoPagoPayment).findOne({
                where: { reservationId, playerIndex: i },
                order: { createdAt: 'DESC' },
            });

            // If there's already a valid pending preference, reuse it
            if (existingPayment && existingPayment.preferenceId &&
                existingPayment.status !== MercadoPagoPaymentStatus.APPROVED) {
                const paymentUrl = `https://www.mercadopago.cl/checkout/v1/redirect?pref_id=${existingPayment.preferenceId}`;
                const shortUrl = await this.shortenUrl(paymentUrl);
                links.push({
                    playerIndex: i,
                    playerName: pp.playerName,
                    amount: Number(pp.amount),
                    paymentUrl,
                    shortUrl,
                    status: existingPayment.status,
                });
                continue;
            }

            const amount = Number(pp.amount);
            const externalReference = `res_${reservationId}_p${i}_${randomUUID().substring(0, 8)}`;
            const description = `${pp.playerName} - ${courtName} - ${reservation.date} ${reservation.startTime}-${reservation.endTime}`;

            try {
                const preferenceResponse = await clubPreferenceClient.create({
                    body: {
                        items: [
                            {
                                id: `${reservationId}_p${i}`,
                                title: description,
                                quantity: 1,
                                unit_price: amount,
                                currency_id: 'CLP',
                            },
                        ],
                        external_reference: externalReference,
                        back_urls: {
                            success: `${appUrl}/player/my-bookings?payment=success&rid=${reservationId}`,
                            failure: `${appUrl}/player/my-bookings?payment=failure&rid=${reservationId}`,
                            pending: `${appUrl}/player/my-bookings?payment=pending&rid=${reservationId}`,
                        },
                        auto_return: 'approved',
                        notification_url: `${backendUrl}/api/payments/webhook${reservation.clubId ? `?clubId=${reservation.clubId}` : ''}`,
                        statement_descriptor: 'Agon Padel',
                    },
                });

                // Create or update payment record
                if (existingPayment) {
                    await this.tenant.getRepo(MercadoPagoPayment).update(existingPayment.id, {
                        preferenceId: preferenceResponse.id,
                        externalReference,
                        amount,
                        description,
                        status: MercadoPagoPaymentStatus.PENDING,
                        mpPaymentId: null,
                        mpData: null,
                        statusDetail: null,
                        paymentMethod: null,
                    });
                } else {
                    await this.tenant.getRepo(MercadoPagoPayment).insert({
                        reservationId,
                        clubId: reservation.clubId,
                        preferenceId: preferenceResponse.id,
                        externalReference,
                        amount,
                        description,
                        playerIndex: i,
                        playerName: pp.playerName,
                        playerId: pp.playerId || null,
                        status: MercadoPagoPaymentStatus.PENDING,
                    });
                }

                const paymentUrl = preferenceResponse.init_point;
                const shortUrl = await this.shortenUrl(paymentUrl);

                links.push({
                    playerIndex: i,
                    playerName: pp.playerName,
                    amount,
                    paymentUrl,
                    shortUrl,
                    status: 'pending',
                });
            } catch (error) {
                this.logger.error(`Error creating per-player preference for player ${i}: ${error.message}`);
                links.push({
                    playerIndex: i,
                    playerName: pp.playerName,
                    amount,
                    paymentUrl: '',
                    shortUrl: '',
                    status: 'error',
                });
            }
        }

        return { links };
    }

    /**
     * Shorten a URL using is.gd free service
     */
    private async shortenUrl(url: string): Promise<string> {
        try {
            const response = await fetch(
                `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`,
            );
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            this.logger.warn(`URL shortening failed: ${error.message}`);
        }
        return url; // Fallback to original URL
    }

    /**
     * Reconcile a per-player payment: mark the player as paid,
     * then check if all players have paid to update overall reservation status.
     */
    private async reconcilePerPlayerPayment(reservationId: string, playerIndex: number, mpPaymentId: string): Promise<void> {
        const reservation = await this.tenant.getRepo(Reservation).findOne({ where: { id: reservationId } });
        if (!reservation || !reservation.playerPayments) return;

        // Mark this player as paid via Mercado Pago
        if (playerIndex >= 0 && playerIndex < reservation.playerPayments.length) {
            reservation.playerPayments[playerIndex].paid = true;
            reservation.playerPayments[playerIndex].paymentMethod = 'mercado_pago';
            this.logger.log(`💰 Player ${playerIndex} (${reservation.playerPayments[playerIndex].playerName}) marked as paid via MP for reservation ${reservationId}`);
        }

        // Check overall status
        const allPaid = reservation.playerPayments.every(p => p.paid);
        const somePaid = reservation.playerPayments.some(p => p.paid);

        reservation.paymentStatus = allPaid ? PaymentStatus.PAID : somePaid ? PaymentStatus.PARTIAL : PaymentStatus.PENDING;

        if (allPaid) {
            reservation.paymentNotes = `Todos los jugadores pagaron via Mercado Pago`;
            reservation.paymentExpiresAt = null;
            this.logger.log(`✅ All players paid for reservation ${reservationId} – marking as PAID`);
        } else {
            const paidNames = reservation.playerPayments.filter(p => p.paid).map(p => p.playerName).join(', ');
            reservation.paymentNotes = `Pagaron: ${paidNames}`;
            reservation.paymentExpiresAt = null; // Never auto-cancel when any player has paid
            this.logger.log(`½ Partial payment for reservation ${reservationId}: ${paidNames} – timer cleared`);
        }

        await this.tenant.getRepo(Reservation).update(reservationId, {
            playerPayments: reservation.playerPayments,
            paymentStatus: reservation.paymentStatus,
            paymentNotes: reservation.paymentNotes,
            paymentExpiresAt: reservation.paymentExpiresAt,
        });
    }

    /**
     * Reconcile per-player payment using an explicit repo (for webhook context).
     */
    private async reconcilePerPlayerPaymentWithRepo(
        reservationRepo: Repository<Reservation>,
        reservationId: string,
        playerIndex: number,
        mpPaymentId: string,
    ): Promise<void> {
        const reservation = await reservationRepo.findOne({ where: { id: reservationId } });
        if (!reservation || !reservation.playerPayments) return;

        if (playerIndex >= 0 && playerIndex < reservation.playerPayments.length) {
            reservation.playerPayments[playerIndex].paid = true;
            reservation.playerPayments[playerIndex].paymentMethod = 'mercado_pago';
            this.logger.log(`💰 Player ${playerIndex} (${reservation.playerPayments[playerIndex].playerName}) marked as paid via MP for reservation ${reservationId}`);
        }

        const allPaid = reservation.playerPayments.every(p => p.paid);
        const somePaid = reservation.playerPayments.some(p => p.paid);

        reservation.paymentStatus = allPaid ? PaymentStatus.PAID : somePaid ? PaymentStatus.PARTIAL : PaymentStatus.PENDING;

        if (allPaid) {
            reservation.paymentNotes = `Todos los jugadores pagaron via Mercado Pago`;
            reservation.paymentExpiresAt = null;
            this.logger.log(`✅ All players paid for reservation ${reservationId} – marking as PAID`);
        } else {
            const paidNames = reservation.playerPayments.filter(p => p.paid).map(p => p.playerName).join(', ');
            reservation.paymentNotes = `Pagaron: ${paidNames}`;
            reservation.paymentExpiresAt = null;
            this.logger.log(`½ Partial payment for reservation ${reservationId}: ${paidNames} – timer cleared`);
        }

        await reservationRepo.update(reservationId, {
            playerPayments: reservation.playerPayments,
            paymentStatus: reservation.paymentStatus,
            paymentNotes: reservation.paymentNotes,
            paymentExpiresAt: reservation.paymentExpiresAt,
        });
    }

    /**
     * Send payment confirmation email using an explicit repo (for webhook context).
     */
    private async sendPaymentConfirmationEmailWithRepo(
        reservationRepo: Repository<Reservation>,
        reservationId: string,
        mpPaymentId: string,
        payerEmail?: string,
    ): Promise<void> {
        try {
            const reservation = await reservationRepo.findOne({
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

        // clubId is appended to the notification_url as ?clubId=... so MP passes it back in query
        const clubId = query.clubId as string | undefined;
        this.logger.log(`Webhook clubId from query: ${clubId || 'NONE'}`);

        if (!clubId) {
            this.logger.error('Webhook missing clubId query parameter – cannot determine club schema');
            return;
        }

        const { paymentClient: clubPaymentClient } = await this.getMpClientsForClub(clubId);

        if (!clubPaymentClient) {
            this.logger.error('Payment client not configured – cannot process webhook');
            return;
        }

        try {
            // Fetch payment details from MP
            const mpPayment = await clubPaymentClient.get({ id: Number(paymentId) });
            const externalReference = mpPayment.external_reference;
            const status = mpPayment.status; // approved, pending, rejected, etc.
            const statusDetail = mpPayment.status_detail;

            this.logger.log(`Payment ${paymentId}: status=${status}, detail=${statusDetail}, ref=${externalReference}`);

            // Run all DB operations within the club's schema context
            await this.tenant.run(clubId, async (em) => {
                const mpRepo = em.getRepository(MercadoPagoPayment);
                const reservationRepo = em.getRepository(Reservation);

                // Find our payment record
                const payment = await mpRepo.findOne({
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
                await mpRepo.update(payment.id, {
                    mpPaymentId: String(paymentId),
                    status: this.mapMpStatus(status),
                    statusDetail,
                    paymentMethod: mpPayment.payment_method_id || null,
                    mpData: mpPayment as any,
                });

                // If approved, update reservation payment status and send confirmation email
                if (status === 'approved') {
                    this.logger.log(`✅ Payment approved for reservation ${payment.reservationId}`);

                    if (payment.playerIndex !== null && payment.playerIndex !== undefined) {
                        // Per-player payment – reconcile
                        await this.reconcilePerPlayerPaymentWithRepo(reservationRepo, payment.reservationId, payment.playerIndex, String(paymentId));
                    } else {
                        // Full-court payment
                        await reservationRepo.update(payment.reservationId, {
                            paymentStatus: PaymentStatus.PAID,
                            paymentMethod: PaymentMethod.MERCADO_PAGO,
                            paymentNotes: `Pagado via Mercado Pago (ID: ${paymentId})`,
                            paymentExpiresAt: null,
                        });
                        await this.sendPaymentConfirmationEmailWithRepo(reservationRepo, payment.reservationId, String(paymentId), payment.payerEmail);
                    }
                } else if (statusDetail === 'pending_contingency') {
                    this.logger.log(`⏳ Payment pending_contingency for reservation ${payment.reservationId} – clearing deadline`);
                    await reservationRepo.update(payment.reservationId, {
                        paymentExpiresAt: null, // Don't auto-cancel while MP is reviewing
                    });
                } else if (status === 'rejected') {
                    // Just log – let the timer handle deletion so the user can retry
                    this.logger.log(`❌ Payment rejected for reservation ${payment.reservationId} – waiting for timer to expire`);
                } else if (status === 'cancelled') {
                    this.logger.log(`❌ Payment cancelled for reservation ${payment.reservationId} – deleting reservation`);
                    const reservation = await reservationRepo.findOne({ where: { id: payment.reservationId } });
                    if (reservation) {
                        await reservationRepo.remove(reservation);
                        this.logger.log(`🗑️ Deleted reservation ${payment.reservationId} and its payment records`);
                    }
                }
            });
        } catch (error) {
            this.logger.error(`Error processing webhook: ${error.message}`);
        }
    }

    /**
     * Sync payment status from MP API (called when user returns from checkout).
     * Uses tenant.run() for a dedicated QR with guaranteed search_path.
     */
    async syncPaymentStatus(reservationId: string): Promise<{ status: string; synced: boolean }> {
        const clubId = this.tenant.getCurrentClubId();
        if (!clubId) {
            this.logger.warn('syncPaymentStatus called without tenant context');
            return { status: 'no_context', synced: false };
        }

        return this.tenant.run(clubId, async (em) => {
            const mpRepo = em.getRepository(MercadoPagoPayment);
            const reservationRepo = em.getRepository(Reservation);

            const payment = await mpRepo.findOne({
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
                    await mpRepo.update(payment.id, {
                        mpPaymentId: String(mpPayment.id),
                        status: this.mapMpStatus(mpStatus),
                        statusDetail: mpPayment.status_detail,
                        paymentMethod: mpPayment.payment_method_id || null,
                        mpData: mpPayment as any,
                    });

                    // If approved, update reservation and send confirmation email
                    if (payment.reservationId) {
                        if (mpStatus === 'approved') {
                            await reservationRepo.update(payment.reservationId, {
                                paymentStatus: PaymentStatus.PAID,
                                paymentNotes: `Pagado via Mercado Pago (ID: ${mpPayment.id})`,
                                paymentExpiresAt: null,
                            });
                            this.logger.log(`\u2705 Reservation ${payment.reservationId} marked as PAID via sync`);
                            await this.sendPaymentConfirmationEmailWithRepo(reservationRepo, payment.reservationId, String(mpPayment.id), payment.payerEmail);
                        } else if (mpPayment.status_detail === 'pending_contingency') {
                            this.logger.log(`\u23f3 Payment pending_contingency for reservation ${payment.reservationId} via sync \u2013 clearing deadline`);
                            await reservationRepo.update(payment.reservationId, {
                                paymentExpiresAt: null,
                            });
                        } else if (mpStatus === 'rejected') {
                            this.logger.log(`\u274c Payment rejected for reservation ${payment.reservationId} via sync \u2013 waiting for timer`);
                        } else if (mpStatus === 'cancelled') {
                            this.logger.log(`\u274c Payment cancelled for reservation ${payment.reservationId} via sync \u2013 deleting reservation`);
                            await reservationRepo.delete(payment.reservationId);
                            this.logger.log(`\ud83d\uddd1\ufe0f Deleted reservation ${payment.reservationId} and its payment records`);
                        }
                    }

                    return { status: mpStatus, synced: true };
                }
            } catch (error) {
                this.logger.error(`Error syncing payment: ${error.message}`);
            }

            return { status: payment.status, synced: false };
        });
    }

    /**
     * Get payment status for a reservation
     */
    async getPaymentStatus(reservationId: string): Promise<MercadoPagoPayment | null> {
        return this.tenant.getRepo(MercadoPagoPayment).findOne({
            where: { reservationId },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Get all payments for a club
     */
    async getClubPayments(clubId: string, limit = 50): Promise<MercadoPagoPayment[]> {
        return this.tenant.getRepo(MercadoPagoPayment).find({
            where: { clubId },
            order: { createdAt: 'DESC' },
            take: limit,
            relations: ['reservation'],
        });
    }

    /**
     * Load reservation with court and send payment confirmation email.
     * Uses tenant.run() for a dedicated QR.
     */
    private async sendPaymentConfirmationEmail(reservationId: string, mpPaymentId: string, payerEmail?: string): Promise<void> {
        const clubId = this.tenant.getCurrentClubId();
        if (!clubId) {
            this.logger.warn('sendPaymentConfirmationEmail: no tenant context');
            return;
        }
        try {
            await this.tenant.run(clubId, async (em) => {
                const reservationRepo = em.getRepository(Reservation);
                await this.sendPaymentConfirmationEmailWithRepo(reservationRepo, reservationId, mpPaymentId, payerEmail);
            });
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

    /**
     * Send a payment link to a player via WhatsApp or email.
     * The admin passes: the payment link URL, player info, channel, and reservation context.
     */
    async sendPlayerPaymentLink(dto: {
        channel: 'whatsapp' | 'email';
        contact: string;        // phone (E.164) for whatsapp, email address for email
        playerName: string;
        link: string;
        clubName: string;
        date: string;           // YYYY-MM-DD
        time: string;           // e.g. "15:00 - 16:30"
        courtName: string;
        amount: number;
    }): Promise<{ sent: boolean; channel: string }> {
        const [year, month, day] = dto.date.split('-');
        const formattedDate = `${day}/${month}/${year}`;
        const concept = `Reserva de cancha en ${dto.clubName}`;

        if (dto.channel === 'whatsapp') {
            await this.notificationsService.sendPaymentLink(dto.contact, {
                playerName: dto.playerName,
                amount: String(dto.amount),
                concept,
                link: dto.link,
                clubName: dto.clubName,
                date: formattedDate,
                time: dto.time,
                courtName: dto.courtName,
            });
            return { sent: true, channel: 'whatsapp' };
        }

        // Email channel
        const from = this.configService.get<string>('SMTP_FROM', this.configService.get<string>('SMTP_USER', 'noreply@padelmgr.com'));
        const subject = `🎾 ${dto.clubName} — Link de pago para tu reserva`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
                <h2 style="text-align: center; color: #333;">🎾 ${dto.clubName}</h2>
                <div style="background: #f0f6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 24px; margin: 20px 0;">
                    <p style="margin: 0 0 16px 0; color: #1e3a8a; font-size: 15px;">
                        Hola <strong>${dto.playerName}</strong>,<br><br>
                        Tienes un pago pendiente para la siguiente reserva de cancha:
                    </p>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                        <tr>
                            <td style="padding: 8px 0; color: #555; font-weight: bold; width: 130px;">📅 Fecha:</td>
                            <td style="padding: 8px 0; color: #111;">${formattedDate}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #555; font-weight: bold;">⏰ Horario:</td>
                            <td style="padding: 8px 0; color: #111;">${dto.time}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #555; font-weight: bold;">🎾 Cancha:</td>
                            <td style="padding: 8px 0; color: #111;">${dto.courtName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #555; font-weight: bold;">💰 Monto:</td>
                            <td style="padding: 8px 0; color: #111; font-weight: bold;">$${Number(dto.amount).toLocaleString('es-CL')}</td>
                        </tr>
                    </table>
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${dto.link}"
                           style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white;
                                  padding: 14px 32px; border-radius: 10px; text-decoration: none;
                                  font-weight: bold; font-size: 16px; display: inline-block;">
                            💳 Pagar ahora
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">
                        O copia este enlace en tu navegador:<br>
                        <a href="${dto.link}" style="color: #2563eb; word-break: break-all;">${dto.link}</a>
                    </p>
                </div>
                <p style="color: #999; font-size: 12px; text-align: center;">© ${dto.clubName} — Agon Padel</p>
            </div>
        `;

        await this.emailService.sendEmail(dto.contact, subject, html).catch(() => {});

        return { sent: true, channel: 'email' };
    }
}
