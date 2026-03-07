import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendMessageResult } from '../dto/send-message.dto';
import { ResolvedTwilioCreds } from '../../clubs/dto/club-credentials.dto';

/**
 * TwilioService - raw Twilio API wrapper.
 * Handles actual message dispatch via Twilio REST API.
 * Use NotificationsService (the generic layer) instead of this directly.
 */
@Injectable()
export class TwilioService {
    private readonly logger = new Logger(TwilioService.name);
    private readonly accountSid: string;
    private readonly authToken: string;
    private readonly whatsappFromNumber: string;
    private readonly enabled: boolean;

    constructor(private readonly config: ConfigService) {
        this.accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID', '');
        this.authToken = this.config.get<string>('TWILIO_AUTH_TOKEN', '');
        this.whatsappFromNumber = this.config.get<string>('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886'); // Twilio sandbox default
        this.enabled = !!(this.accountSid && this.authToken);

        if (!this.enabled) {
            this.logger.warn('⚠️  Twilio is NOT configured. Messages will be logged only. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars.');
        }
    }

    async sendWhatsApp(to: string, body: string, creds?: ResolvedTwilioCreds): Promise<SendMessageResult> {
        const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

        // Resolve credentials: per-club override takes priority, fall back to env
        const accountSid = creds?.accountSid || this.accountSid;
        const authToken = creds?.authToken || this.authToken;
        const whatsappFrom = creds?.whatsappFrom || this.whatsappFromNumber;
        const isEnabled = !!(accountSid && authToken);

        if (!isEnabled) {
            this.logger.log(`[TWILIO MOCK] WhatsApp → ${toFormatted}: ${body}`);
            return { success: true, messageId: `mock_${Date.now()}` };
        }

        try {
            // Dynamic import to avoid build issues when twilio is not installed
            const twilio = require('twilio');
            const client = twilio(accountSid, authToken);

            const message = await client.messages.create({
                body,
                from: whatsappFrom,
                to: toFormatted,
            });

            this.logger.log(`✅ WhatsApp sent to ${to}. SID: ${message.sid}`);
            return { success: true, messageId: message.sid };
        } catch (err: any) {
            this.logger.error(`❌ Failed to send WhatsApp to ${to}: ${err.message}`);
            return { success: false, error: err.message };
        }
    }
}
