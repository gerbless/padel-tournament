import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { randomUUID } from 'crypto';

interface OtpRecord {
    code: string;
    expiresAt: number; // epoch ms
    attempts: number;
}

interface VerifiedRecord {
    token: string;
    expiresAt: number; // epoch ms
}

const OTP_TTL_MS = 5 * 60 * 1000;       // 5 minutes
const VERIFIED_TTL_MS = 15 * 60 * 1000; // 15 minutes to complete registration
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;    // 1 minute between resends

/**
 * PhoneVerificationService
 *
 * Manages OTP generation, delivery via WhatsApp, and verification.
 * Uses an in-memory store (Map) with TTL — no DB required for OTPs.
 *
 * Flow:
 *   1. Client calls sendOtp(phone) → generates 6-digit code, sends via WhatsApp
 *   2. Client calls verifyOtp(phone, code) → returns a short-lived verificationToken
 *   3. Registration endpoint validates verificationToken before creating the user
 */
@Injectable()
export class PhoneVerificationService {
    private readonly logger = new Logger(PhoneVerificationService.name);

    /** Active OTP codes: phone → OtpRecord */
    private readonly otpStore = new Map<string, OtpRecord>();

    /** Successfully verified phones: token → VerifiedRecord (token → phone) */
    private readonly verifiedStore = new Map<string, string>(); // token → phone
    private readonly verifiedPhones = new Map<string, VerifiedRecord>(); // phone → VerifiedRecord

    constructor(private readonly notifications: NotificationsService) {
        // Periodic cleanup every 10 minutes
        setInterval(() => this.cleanup(), 10 * 60 * 1000);
    }

    /**
     * Send a verification OTP to the given phone number via WhatsApp.
     * Returns { sent: true } or throws.
     */
    async sendOtp(phone: string, clubName?: string): Promise<{ sent: boolean; devCode?: string }> {
        const now = Date.now();

        // Cooldown check
        const existing = this.otpStore.get(phone);
        if (existing && existing.expiresAt > now) {
            const cooldownUntil = existing.expiresAt - OTP_TTL_MS + RESEND_COOLDOWN_MS;
            if (now < cooldownUntil) {
                const secondsLeft = Math.ceil((cooldownUntil - now) / 1000);
                throw new BadRequestException(
                    `Espera ${secondsLeft} segundos antes de solicitar un nuevo código.`
                );
            }
        }

        const code = this.generateCode();
        this.otpStore.set(phone, {
            code,
            expiresAt: now + OTP_TTL_MS,
            attempts: 0,
        });

        const result = await this.notifications.sendPhoneOtp(phone, code, clubName);

        if (!result.success) {
            this.otpStore.delete(phone);
            throw new BadRequestException(
                `No se pudo enviar el código de verificación. Verifica el número e intenta de nuevo.`
            );
        }

        this.logger.log(`OTP sent to ${phone}`);

        // In dev/mock mode expose the code in response so it can be tested without WhatsApp
        const isDev = process.env.NODE_ENV !== 'production';
        return {
            sent: true,
            ...(isDev && result.messageId?.startsWith('mock_') ? { devCode: code } : {}),
        };
    }

    /**
     * Verify the OTP code entered by the user.
     * Returns a verificationToken that must be passed to the registration endpoint.
     */
    async verifyOtp(phone: string, code: string): Promise<{ verified: boolean; verificationToken: string }> {
        const record = this.otpStore.get(phone);

        if (!record) {
            throw new BadRequestException('No hay un código de verificación activo para este número. Solicita uno nuevo.');
        }

        if (Date.now() > record.expiresAt) {
            this.otpStore.delete(phone);
            throw new BadRequestException('El código ha expirado. Solicita uno nuevo.');
        }

        record.attempts++;
        if (record.attempts > MAX_ATTEMPTS) {
            this.otpStore.delete(phone);
            throw new BadRequestException('Demasiados intentos fallidos. Solicita un nuevo código.');
        }

        if (record.code !== code.trim()) {
            const remaining = MAX_ATTEMPTS - record.attempts;
            throw new BadRequestException(
                `Código incorrecto. Te quedan ${remaining} intento${remaining !== 1 ? 's' : ''}.`
            );
        }

        // Success — generate verification token
        this.otpStore.delete(phone);
        const token = randomUUID();
        const expiresAt = Date.now() + VERIFIED_TTL_MS;

        this.verifiedStore.set(token, phone);
        this.verifiedPhones.set(phone, { token, expiresAt });

        this.logger.log(`Phone ${phone} verified. Token: ${token}`);
        return { verified: true, verificationToken: token };
    }

    /**
     * Validate a verificationToken obtained after OTP verification.
     * Returns the phone number if valid, throws otherwise.
     */
    validateVerificationToken(token: string): string {
        const phone = this.verifiedStore.get(token);
        if (!phone) {
            throw new BadRequestException('Token de verificación de teléfono inválido o expirado. Verifica tu número nuevamente.');
        }

        const record = this.verifiedPhones.get(phone);
        if (!record || Date.now() > record.expiresAt) {
            this.verifiedStore.delete(token);
            this.verifiedPhones.delete(phone);
            throw new BadRequestException('La verificación de teléfono ha expirado. Verifica tu número nuevamente.');
        }

        return phone;
    }

    /**
     * Consume (invalidate) a verification token after it's been used for registration.
     */
    consumeVerificationToken(token: string): void {
        const phone = this.verifiedStore.get(token);
        if (phone) {
            this.verifiedPhones.delete(phone);
        }
        this.verifiedStore.delete(token);
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private generateCode(): string {
        return String(Math.floor(100000 + Math.random() * 900000));
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [phone, record] of this.otpStore.entries()) {
            if (now > record.expiresAt) this.otpStore.delete(phone);
        }
        for (const [token, phone] of this.verifiedStore.entries()) {
            const vr = this.verifiedPhones.get(phone);
            if (!vr || now > vr.expiresAt) {
                this.verifiedStore.delete(token);
                this.verifiedPhones.delete(phone);
            }
        }
    }
}
