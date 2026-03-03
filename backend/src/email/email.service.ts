import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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

    async sendVerificationEmail(to: string, token: string): Promise<void> {
        const appUrl = this.configService.get<string>('APP_URL', 'http://localhost');
        const from = this.configService.get<string>('SMTP_FROM', this.configService.get<string>('SMTP_USER', 'noreply@padelmgr.com'));
        const verifyLink = `${appUrl}/verify-email?token=${token}`;

        this.logger.log(`--- Enviando email de verificación ---`);
        this.logger.log(`  To: ${to}`);
        this.logger.log(`  From: ${from}`);
        this.logger.log(`  Link: ${verifyLink}`);
        this.logger.log(`  Transporter: ${this.transporter ? 'SÍ' : 'NO'}`);
        this.logger.log(`  SMTP Ready: ${this.smtpReady}`);

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

        if (this.transporter) {
            try {
                const info = await this.transporter.sendMail({ from, to, subject, html });
                this.logger.log(`✅ Email enviado exitosamente a ${to}`);
                this.logger.log(`   Message ID: ${info.messageId}`);
                this.logger.log(`   Response: ${info.response}`);
            } catch (error) {
                this.logger.error(`❌ Error enviando email a ${to}:`);
                this.logger.error(`   Error: ${error.message}`);
                this.logger.error(`   Code: ${error.code || 'N/A'}`);
                this.logger.error(`   Stack: ${error.stack}`);
            }
        } else {
            this.logger.warn(`⚠️  [SIN SMTP] Email NO enviado a ${to}`);
            this.logger.warn(`⚠️  [SIN SMTP] Link de verificación: ${verifyLink}`);
            this.logger.warn(`⚠️  Configura SMTP_USER y SMTP_PASS en docker-compose.yml para enviar emails reales`);
        }
    }
}
