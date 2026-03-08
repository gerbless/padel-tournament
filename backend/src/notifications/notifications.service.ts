import { Injectable, Logger } from '@nestjs/common';
import { TwilioService } from './providers/twilio.service';
import { SendMessageDto, SendMessageResult, NotificationChannel, NotificationTemplate } from './dto/send-message.dto';
import { ResolvedTwilioCreds } from '../clubs/dto/club-credentials.dto';

/**
 * NotificationsService — Generic messaging layer.
 *
 * This is the ONLY service other modules should use to send messages.
 * It handles template rendering and channel routing.
 *
 * Supported channels: WhatsApp (via Twilio), more can be added.
 *
 * Template catalogue:
 *   PHONE_OTP             → Phone verification code
 *   RESERVATION_CONFIRM   → Reservation confirmed (to player)
 *   RESERVATION_REMINDER  → Reminder before reservation (to player)
 *   PAYMENT_LINK          → Payment link (to player)
 *   MATCH_SUGGESTION      → Match suggestion (to player)
 *   ADMIN_COURT_BOOKED    → Court booked notification (to admin)
 *   CUSTOM                → Free-form message (provide customBody)
 */
@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(private readonly twilio: TwilioService) {}

    async send(dto: SendMessageDto): Promise<SendMessageResult> {
        const body = this.buildMessage(dto);
        const channel = dto.channel ?? NotificationChannel.WHATSAPP;

        switch (channel) {
            case NotificationChannel.WHATSAPP:
                return this.twilio.sendWhatsApp(dto.to, body, dto.twilioCreds);
            default:
                this.logger.warn(`Channel ${channel} not implemented. Falling back to WhatsApp.`);
                return this.twilio.sendWhatsApp(dto.to, body, dto.twilioCreds);
        }
    }

    // ─── Convenience shortcuts ────────────────────────────────────────────────

    async sendPhoneOtp(to: string, code: string, clubName = 'Padel MGR', twilioCreds?: ResolvedTwilioCreds): Promise<SendMessageResult> {
        return this.send({
            to,
            template: NotificationTemplate.PHONE_OTP,
            params: { code, clubName },
            twilioCreds,
        });
    }

    async sendReservationConfirm(to: string, params: {
        playerName: string;
        courtName: string;
        date: string;
        time: string;
        clubName: string;
    }): Promise<SendMessageResult> {
        return this.send({ to, template: NotificationTemplate.RESERVATION_CONFIRM, params });
    }

    async sendAdminCourtBooked(to: string, params: {
        playerName: string;
        courtName: string;
        date: string;
        time: string;
    }): Promise<SendMessageResult> {
        return this.send({ to, template: NotificationTemplate.ADMIN_COURT_BOOKED, params });
    }

    async sendBookingConfirmWithTransfer(to: string, params: {
        playerName: string;
        courtName: string;
        date: string;
        time: string;
        clubName: string;
        amount: string;
        transferInfo?: string; // pre-formatted transfer info block
    }, twilioCreds?: ResolvedTwilioCreds): Promise<SendMessageResult> {
        return this.send({ to, template: NotificationTemplate.RESERVATION_BOOKING_TRANSFER, params, twilioCreds });
    }

    async sendPaymentLink(to: string, params: {
        playerName: string;
        amount: string;
        concept?: string;
        link: string;
        clubName?: string;
        date?: string;
        time?: string;
        courtName?: string;
    }, twilioCreds?: ResolvedTwilioCreds): Promise<SendMessageResult> {
        return this.send({ to, template: NotificationTemplate.PAYMENT_LINK, params, twilioCreds });
    }

    async sendMatchSuggestion(to: string, params: {
        playerName: string;
        opponentName: string;
        courtName?: string;
        date?: string;
    }): Promise<SendMessageResult> {
        return this.send({ to, template: NotificationTemplate.MATCH_SUGGESTION, params });
    }

    async sendCustom(to: string, body: string): Promise<SendMessageResult> {
        return this.send({ to, template: NotificationTemplate.CUSTOM, customBody: body });
    }

    // ─── Template Renderer ─────────────────────────────────────────────────────

    private buildMessage(dto: SendMessageDto): string {
        const p = dto.params || {};

        switch (dto.template) {
            case NotificationTemplate.PHONE_OTP:
                return (
                    `🎾 *${p['clubName'] ?? 'Padel MGR'}*\n\n` +
                    `Tu código de verificación es:\n\n` +
                    `*${p['code']}*\n\n` +
                    `Válido por 5 minutos. No lo compartas con nadie.`
                );

            case NotificationTemplate.RESERVATION_CONFIRM:
                return (
                    `✅ *Reserva Confirmada — ${p['clubName']}*\n\n` +
                    `Hola ${p['playerName']}, tu reserva está confirmada:\n` +
                    `📅 ${p['date']} a las ${p['time']}\n` +
                    `🎾 Cancha: ${p['courtName']}\n\n` +
                    `¡Nos vemos en la cancha!`
                );

            case NotificationTemplate.RESERVATION_REMINDER:
                return (
                    `⏰ *Recordatorio de Reserva*\n\n` +
                    `Hola ${p['playerName']}, te recordamos tu reserva:\n` +
                    `📅 ${p['date']} a las ${p['time']}\n` +
                    `🎾 Cancha: ${p['courtName']}`
                );

            case NotificationTemplate.PAYMENT_LINK:
                return (
                    `💳 *Reserva de Cancha — ${p['clubName'] ?? p['concept'] ?? 'Padel MGR'}*\n\n` +
                    `Hola ${p['playerName']}, tienes un pago pendiente para:\n\n` +
                    `📅 *Fecha:* ${p['date'] ?? ''}${p['date'] ? ' — ' + p['time'] : ''}\n` +
                    `🎾 *Cancha:* ${p['courtName'] ?? ''}\n` +
                    `💰 *Monto a pagar:* $${p['amount']}\n\n` +
                    `Realiza tu pago de forma segura en el siguiente enlace:\n` +
                    `${p['link']}`
                );

            case NotificationTemplate.MATCH_SUGGESTION:
                return (
                    `🏓 *Sugerencia de Partido*\n\n` +
                    `Hola ${p['playerName']}, ¡te sugerimos un partido!\n` +
                    `Adversario: ${p['opponentName']}\n` +
                    (p['courtName'] ? `Cancha: ${p['courtName']}\n` : '') +
                    (p['date'] ? `Fecha sugerida: ${p['date']}` : '')
                );

            case NotificationTemplate.RESERVATION_BOOKING_TRANSFER: {
                const tf = p['transferInfo'] ? `\n\n🏦 *Datos para Transferencia:*\n${p['transferInfo']}` : '';
                return (
                    `✅ *Reserva Confirmada — ${p['clubName']}*\n\n` +
                    `Hola ${p['playerName']}, tu reserva está confirmada:\n` +
                    `📅 ${p['date']} a las ${p['time']}\n` +
                    `🎾 Cancha: ${p['courtName']}\n` +
                    `💰 Monto: $${p['amount']}` +
                    `${tf}\n\n` +
                    `¡Nos vemos en la cancha!`
                );
            }

            case NotificationTemplate.ADMIN_COURT_BOOKED:
                return (
                    `📋 *Nueva Reserva de Cancha*\n\n` +
                    `Jugador: ${p['playerName']}\n` +
                    `Cancha: ${p['courtName']}\n` +
                    `📅 ${p['date']} a las ${p['time']}`
                );

            case NotificationTemplate.CUSTOM:
                return dto.customBody ?? '';

            default:
                return dto.customBody ?? '';
        }
    }
}
