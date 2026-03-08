import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ResolvedSmtpCreds } from '../clubs/dto/club-credentials.dto';

@Injectable()
export class EmailService implements OnModuleInit {
    private readonly logger = new Logger(EmailService.name);
    private transporter: nodemailer.Transporter;
    private smtpReady = false;

    constructor(private configService: ConfigService) {
        const smtpHost = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
        const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
        const smtpUser = this.configService.get<string>('SMTP_USER', '');
        const smtpPass = this.configService.get<string>('SMTP_PASS', '');

        this.logger.log(`=== EMAIL CONFIG ===`);
        this.logger.log(`SMTP_HOST: ${smtpHost}`);
        this.logger.log(`SMTP_PORT: ${smtpPort}`);
        this.logger.log(`SMTP_USER: ${smtpUser ? smtpUser.substring(0, 3) + '***' : '(vacío)'}`);
        this.logger.log(`SMTP_PASS: ${smtpPass ? '****configurado****' : '(vacío)'}`);
        this.logger.log(`SMTP_FROM: ${this.configService.get<string>('SMTP_FROM', '(vacío)')}`);
        this.logger.log(`APP_URL: ${this.configService.get<string>('APP_URL', 'http://localhost')}`);

        if (smtpUser && smtpPass) {
            this.transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: {
                    user: smtpUser,
                    pass: smtpPass,
                },
            });
            this.logger.log('Transporter creado con credenciales SMTP');
        } else {
            this.logger.warn('⚠️  SMTP_USER o SMTP_PASS están vacíos – los emails NO se enviarán, solo se loguean a consola');
            this.logger.warn('⚠️  Para enviar emails reales, configura SMTP_USER y SMTP_PASS en docker-compose.yml');
        }
    }

    async onModuleInit() {
        if (this.transporter) {
            try {
                await this.transporter.verify();
                this.smtpReady = true;
                this.logger.log('✅ Conexión SMTP verificada correctamente – emails se enviarán');
            } catch (error) {
                this.smtpReady = false;
                this.logger.error('❌ Error al verificar conexión SMTP:', error.message);
                this.logger.error('   Revisa SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS');
            }
        }
    }

    getStatus(): { configured: boolean; connected: boolean; smtpUser: string } {
        const smtpUser = this.configService.get<string>('SMTP_USER', '');
        return {
            configured: !!this.transporter,
            connected: this.smtpReady,
            smtpUser: smtpUser ? smtpUser.substring(0, 3) + '***' : '',
        };
    }

    /** Build a transporter from explicit creds (per-club) or return the global one. */
    private getTransporter(smtpCreds?: ResolvedSmtpCreds): { transporter: nodemailer.Transporter | null; from: string } {
        if (smtpCreds) {
            const t = nodemailer.createTransport({
                host: smtpCreds.host,
                port: smtpCreds.port,
                secure: smtpCreds.port === 465,
                auth: { user: smtpCreds.user, pass: smtpCreds.pass },
            });
            return { transporter: t, from: smtpCreds.from || smtpCreds.user };
        }
        const from = this.configService.get<string>('SMTP_FROM', this.configService.get<string>('SMTP_USER', 'noreply@padelmgr.com'));
        return { transporter: this.transporter || null, from };
    }

    async sendVerificationEmail(to: string, token: string, smtpCreds?: ResolvedSmtpCreds): Promise<void> {
        const appUrl = this.configService.get<string>('APP_URL', 'http://localhost');
        const { transporter, from } = this.getTransporter(smtpCreds);
        const verifyLink = `${appUrl}/verify-email?token=${token}`;

        this.logger.log(`--- Enviando email de verificación ---`);
        this.logger.log(`  To: ${to}`);
        this.logger.log(`  From: ${from}`);
        this.logger.log(`  Link: ${verifyLink}`);
        this.logger.log(`  Transporter: ${transporter ? 'SÍ' : 'NO'}`);

        const subject = 'Verifica tu cuenta – Padel MGR';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="text-align: center; color: #333;">🎾 PADEL MGR</h2>
                <p>¡Hola!</p>
                <p>Gracias por registrarte. Para activar tu cuenta, haz clic en el siguiente enlace:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verifyLink}"
                       style="background: linear-gradient(135deg, #6366f1, #8b5cf6);
                              color: white; padding: 12px 32px; border-radius: 8px;
                              text-decoration: none; font-weight: bold; font-size: 16px;">
                        Verificar mi cuenta
                    </a>
                </div>
                <p style="color: #666; font-size: 13px;">
                    Si no creaste esta cuenta, puedes ignorar este correo.
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                    © Padel MGR
                </p>
            </div>
        `;

        if (transporter) {
            try {
                const info = await transporter.sendMail({ from, to, subject, html });
                this.logger.log(`✅ Email enviado exitosamente a ${to}`);
                this.logger.log(`   Message ID: ${info.messageId}`);
            } catch (error) {
                this.logger.error(`❌ Error enviando email a ${to}: ${error.message}`);
            }
        } else {
            this.logger.warn(`⚠️  [SIN SMTP] Email NO enviado a ${to}`);
            this.logger.warn(`⚠️  [SIN SMTP] Link de verificación: ${verifyLink}`);
            this.logger.warn(`⚠️  Configura SMTP_USER y SMTP_PASS en docker-compose.yml para enviar emails reales`);
        }
    }

    /**
     * Generic email sender — use for any transactional email besides verification.
     */
    async sendEmail(to: string, subject: string, html: string): Promise<void> {
        const from = this.configService.get<string>('SMTP_FROM', this.configService.get<string>('SMTP_USER', 'noreply@padelmgr.com'));
        if (this.transporter) {
            try {
                const info = await this.transporter.sendMail({ from, to, subject, html });
                this.logger.log(`✅ Email enviado a ${to} (ID: ${info.messageId})`);
            } catch (err) {
                this.logger.error(`❌ Error enviando email a ${to}: ${(err as any).message}`);
            }
        } else {
            this.logger.warn(`⚠️  [SIN SMTP] Email no enviado a ${to} — Asunto: ${subject}`);
        }
    }

    /**
     * Send payment confirmation email with reservation details
     */
    async sendPaymentConfirmationEmail(
        to: string,
        reservation: { date: string; startTime: string; endTime: string; courtName: string; finalPrice: number },
        mpPaymentId?: string,
    ): Promise<void> {
        const from = this.configService.get<string>('SMTP_FROM', this.configService.get<string>('SMTP_USER', 'noreply@padelmgr.com'));

        // Format date nicely (YYYY-MM-DD → DD/MM/YYYY)
        const [year, month, day] = reservation.date.split('-');
        const formattedDate = `${day}/${month}/${year}`;

        const subject = `✅ Pago confirmado – Reserva ${reservation.courtName} ${formattedDate}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="text-align: center; color: #333;">🎾 PADEL MGR</h2>
                <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 24px; margin: 20px 0;">
                    <h3 style="color: #16a34a; margin-top: 0;">✅ ¡Pago recibido exitosamente!</h3>
                    <p style="color: #333;">Tu reserva ha sido confirmada con los siguientes detalles:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                        <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold;">📅 Fecha:</td>
                            <td style="padding: 8px 0; color: #333;">${formattedDate}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold;">🕐 Horario:</td>
                            <td style="padding: 8px 0; color: #333;">${reservation.startTime} - ${reservation.endTime}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold;">🏟️ Cancha:</td>
                            <td style="padding: 8px 0; color: #333;">${reservation.courtName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold;">💰 Monto:</td>
                            <td style="padding: 8px 0; color: #333; font-weight: bold;">$${Number(reservation.finalPrice).toLocaleString('es-CL')}</td>
                        </tr>
                        ${mpPaymentId ? `<tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold;">🔖 ID Pago:</td>
                            <td style="padding: 8px 0; color: #999; font-size: 13px;">${mpPaymentId}</td>
                        </tr>` : ''}
                    </table>
                </div>
                <p style="color: #666; font-size: 13px;">¡Nos vemos en la cancha! 🎾</p>
                <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">© Padel MGR</p>
            </div>
        `;

        this.logger.log(`--- Enviando email de confirmación de pago ---`);
        this.logger.log(`  To: ${to}`);
        this.logger.log(`  Cancha: ${reservation.courtName}, Fecha: ${formattedDate}, Hora: ${reservation.startTime}-${reservation.endTime}`);

        if (this.transporter) {
            try {
                const info = await this.transporter.sendMail({ from, to, subject, html });
                this.logger.log(`✅ Email de confirmación enviado a ${to} (ID: ${info.messageId})`);
            } catch (error) {
                this.logger.error(`❌ Error enviando email de confirmación a ${to}: ${error.message}`);
            }
        } else {
            this.logger.warn(`⚠️  [SIN SMTP] Email de confirmación NO enviado a ${to}`);
        }
    }

    /**
     * Email de confirmación de reserva sin pago (cuando MP está desactivado).
     * Incluye los datos de transferencia bancaria del club si están configurados.
     */
    async sendReservationBookingEmail(
        to: string,
        reservation: { date: string; startTime: string; endTime: string; courtName: string; finalPrice: number; clubName: string },
        transferInfo?: {
            bankName?: string;
            accountHolder?: string;
            accountType?: string;
            accountNumber?: string;
            rut?: string;
            email?: string;
            notes?: string;
        } | null,
        smtpCreds?: ResolvedSmtpCreds,
    ): Promise<void> {
        const { transporter, from } = this.getTransporter(smtpCreds);

        const [year, month, day] = reservation.date.split('-');
        const formattedDate = `${day}/${month}/${year}`;
        const formattedPrice = `$${Number(reservation.finalPrice).toLocaleString('es-CL')}`;

        const subject = `✅ Reserva Confirmada – ${reservation.courtName} ${formattedDate}`;

        const transferSection = transferInfo && Object.values(transferInfo).some(v => v) ? `
            <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #92400e; margin-top: 0;">🏦 Datos para Transferencia</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    ${transferInfo.bankName ? `<tr><td style="padding: 6px 0; color: #666; font-weight: bold;">Banco:</td><td style="padding: 6px 0; color: #333;">${transferInfo.bankName}</td></tr>` : ''}
                    ${transferInfo.accountHolder ? `<tr><td style="padding: 6px 0; color: #666; font-weight: bold;">Titular:</td><td style="padding: 6px 0; color: #333;">${transferInfo.accountHolder}</td></tr>` : ''}
                    ${transferInfo.accountType ? `<tr><td style="padding: 6px 0; color: #666; font-weight: bold;">Tipo:</td><td style="padding: 6px 0; color: #333;">${transferInfo.accountType}</td></tr>` : ''}
                    ${transferInfo.accountNumber ? `<tr><td style="padding: 6px 0; color: #666; font-weight: bold;">N° Cuenta:</td><td style="padding: 6px 0; color: #333; font-weight: bold;">${transferInfo.accountNumber}</td></tr>` : ''}
                    ${transferInfo.rut ? `<tr><td style="padding: 6px 0; color: #666; font-weight: bold;">RUT:</td><td style="padding: 6px 0; color: #333;">${transferInfo.rut}</td></tr>` : ''}
                    ${transferInfo.email ? `<tr><td style="padding: 6px 0; color: #666; font-weight: bold;">Email:</td><td style="padding: 6px 0; color: #333;">${transferInfo.email}</td></tr>` : ''}
                    ${transferInfo.notes ? `<tr><td colspan="2" style="padding: 10px 0; color: #555; font-style: italic;">📝 ${transferInfo.notes}</td></tr>` : ''}
                </table>
                <p style="color: #92400e; font-size: 13px; margin-bottom: 0;">Envía el comprobante de pago al club para confirmar tu reserva.</p>
            </div>` : '';

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px;">
                <h2 style="text-align: center; color: #333;">🎾 ${reservation.clubName}</h2>
                <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 24px; margin: 20px 0;">
                    <h3 style="color: #16a34a; margin-top: 0;">✅ ¡Reserva confirmada!</h3>
                    <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
                        <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">📅 Fecha:</td><td style="padding: 8px 0; color: #333;">${formattedDate}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">🕐 Horario:</td><td style="padding: 8px 0; color: #333;">${reservation.startTime} – ${reservation.endTime}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">🏟️ Cancha:</td><td style="padding: 8px 0; color: #333;">${reservation.courtName}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">💰 Monto:</td><td style="padding: 8px 0; color: #333; font-weight: bold;">${formattedPrice}</td></tr>
                    </table>
                </div>
                ${transferSection}
                <p style="color: #666; font-size: 13px;">¡Nos vemos en la cancha! 🎾</p>
                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">© ${reservation.clubName} · Padel MGR</p>
            </div>`;

        this.logger.log(`--- Enviando email de reserva (sin MP) a ${to} ---`);

        if (transporter) {
            try {
                const info = await transporter.sendMail({ from, to, subject, html });
                this.logger.log(`✅ Email de reserva enviado a ${to} (ID: ${info.messageId})`);
            } catch (error) {
                this.logger.error(`❌ Error enviando email de reserva a ${to}: ${error.message}`);
            }
        } else {
            this.logger.warn(`⚠️  [SIN SMTP] Email de reserva NO enviado a ${to}`);
        }
    }
}

