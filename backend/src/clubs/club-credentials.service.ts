import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Club } from './entities/club.entity';
import { UpdateClubCredentialsDto, ResolvedSmtpCreds, ResolvedTwilioCreds, ResolvedMpCreds } from './dto/club-credentials.dto';

@Injectable()
export class ClubCredentialsService {
    private readonly logger = new Logger(ClubCredentialsService.name);

    constructor(
        @InjectRepository(Club)
        private readonly clubRepo: Repository<Club>,
        private readonly config: ConfigService,
    ) {}

    // ─── Read ──────────────────────────────────────────────

    /**
     * Returns MASKED credentials for the super_admin UI.
     * Sensitive strings are partially obfuscated so the user can recognise
     * them without exposing the full secret over the network.
     * Fields that are not set are returned as empty string so the form shows
     * the placeholder instead.
     */
    async getMaskedCredentials(clubId: string): Promise<Record<string, any>> {
        const club = await this.clubRepo
            .createQueryBuilder('club')
            .addSelect('club.credentials')
            .where('club.id = :id', { id: clubId })
            .getOne();

        if (!club) throw new NotFoundException(`Club ${clubId} not found`);

        const c = club.credentials ?? {};
        return {
            smtp: {
                host:  c.smtp?.host  ?? '',
                port:  c.smtp?.port  ?? '',
                user:  this.maskEmail(c.smtp?.user),
                pass:  this.maskSecret(c.smtp?.pass),
                from:  this.maskEmail(c.smtp?.from),
            },
            twilio: {
                accountSid:   this.maskSecret(c.twilio?.accountSid),
                authToken:    this.maskSecret(c.twilio?.authToken),
                whatsappFrom: c.twilio?.whatsappFrom ?? '',
            },
            mercadopago: {
                accessToken: this.maskSecret(c.mercadopago?.accessToken),
                publicKey:   this.maskSecret(c.mercadopago?.publicKey),
            },
        };
    }

    // ─── Write ─────────────────────────────────────────────

    async updateCredentials(clubId: string, dto: UpdateClubCredentialsDto): Promise<void> {
        const club = await this.clubRepo
            .createQueryBuilder('club')
            .addSelect('club.credentials')
            .where('club.id = :id', { id: clubId })
            .getOne();

        if (!club) throw new NotFoundException(`Club ${clubId} not found`);

        const current = club.credentials ?? {};

        // Deep merge — only overwrite provided sub-objects; within each sub-object only provided
        // fields that do NOT contain *** (masked sentinel from the UI → unchanged field, skip it).
        if (dto.smtp) {
            current.smtp = { ...(current.smtp ?? {}), ...(this.stripMasked(dto.smtp as any)) } as any;
        }
        if (dto.twilio) {
            current.twilio = { ...(current.twilio ?? {}), ...(this.stripMasked(dto.twilio as any)) } as any;
        }
        if (dto.mercadopago) {
            current.mercadopago = { ...(current.mercadopago ?? {}), ...(this.stripMasked(dto.mercadopago as any)) } as any;
        }

        await this.clubRepo
            .createQueryBuilder()
            .update(Club)
            .set({ credentials: current } as any)
            .where('id = :id', { id: clubId })
            .execute();

        this.logger.log(`Updated credentials for club ${clubId}`);
    }

    // ─── Effective Credential Resolution ────────────────────

    async getEffectiveSmtpCreds(clubId?: string): Promise<ResolvedSmtpCreds | null> {
        if (clubId) {
            const creds = await this.getClubCredentials(clubId);
            if (creds?.smtp?.user && creds?.smtp?.pass) {
                return {
                    host: creds.smtp.host || 'smtp.gmail.com',
                    port: creds.smtp.port || 587,
                    user: creds.smtp.user,
                    pass: creds.smtp.pass,
                    from: creds.smtp.from || creds.smtp.user,
                };
            }
        }
        // Env fallback
        const user = this.config.get<string>('SMTP_USER', '');
        const pass = this.config.get<string>('SMTP_PASS', '');
        if (!user || !pass) return null;
        return {
            host: this.config.get<string>('SMTP_HOST', 'smtp.gmail.com'),
            port: this.config.get<number>('SMTP_PORT', 587),
            user,
            pass,
            from: this.config.get<string>('SMTP_FROM', user),
        };
    }

    async getEffectiveTwilioCreds(clubId?: string): Promise<ResolvedTwilioCreds | null> {
        if (clubId) {
            const creds = await this.getClubCredentials(clubId);
            if (creds?.twilio?.accountSid && creds?.twilio?.authToken) {
                return {
                    accountSid: creds.twilio.accountSid,
                    authToken: creds.twilio.authToken,
                    whatsappFrom: creds.twilio.whatsappFrom || 'whatsapp:+14155238886',
                };
            }
        }
        // Env fallback
        const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID', '');
        const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN', '');
        if (!accountSid || !authToken) return null;
        return {
            accountSid,
            authToken,
            whatsappFrom: this.config.get<string>('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886'),
        };
    }

    async getEffectiveMpCreds(clubId?: string): Promise<ResolvedMpCreds | null> {
        if (clubId) {
            const creds = await this.getClubCredentials(clubId);
            if (creds?.mercadopago?.accessToken) {
                return {
                    accessToken: creds.mercadopago.accessToken,
                    publicKey: creds.mercadopago.publicKey || '',
                    notificationUrl: creds.mercadopago.notificationUrl,
                };
            }
        }
        // Env fallback
        const accessToken = this.config.get<string>('MP_ACCESS_TOKEN', '');
        if (!accessToken) return null;
        return {
            accessToken,
            publicKey: this.config.get<string>('MP_PUBLIC_KEY', ''),
            notificationUrl: undefined,
        };
    }

    // ─── Private helpers ────────────────────────────────────

    private async getClubCredentials(clubId: string) {
        try {
            const club = await this.clubRepo
                .createQueryBuilder('club')
                .addSelect('club.credentials')
                .where('club.id = :id', { id: clubId })
                .getOne();
            return club?.credentials ?? null;
        } catch {
            return null;
        }
    }

    // ─── Masking helpers ────────────────────────────────────

    /** Mask a generic secret: keep first 2 + last 2 chars. */
    private maskSecret(value: string | undefined): string {
        if (!value) return '';
        if (value.length <= 4) return '***';
        return `${value.slice(0, 2)}***${value.slice(-2)}`;
    }

    /** Mask an email: keep first char + domain. e.g. u***@gmail.com */
    private maskEmail(value: string | undefined): string {
        if (!value) return '';
        const at = value.indexOf('@');
        if (at <= 0) return this.maskSecret(value);  // not a real email, treat as secret
        return `${value[0]}***${value.slice(at)}`;
    }

    // ─── Merge helpers ──────────────────────────────────────

    /**
     * Remove falsy values AND fields whose string value contains '***'
     * (the masked sentinel sent back unchanged by the frontend).
     */
    private stripMasked(obj: Record<string, any>): Record<string, any> {
        return Object.fromEntries(
            Object.entries(obj).filter(([, v]) => {
                if (v === undefined || v === null || v === '') return false;
                if (typeof v === 'string' && v.includes('***')) return false;
                return true;
            })
        );
    }
}
