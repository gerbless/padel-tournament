
import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { UsersService } from '../users/users.service';
import { PlayersService } from '../players/players.service';
import { RegisterDto } from './dto/register.dto';
import { EmailService } from '../email/email.service';
import { PhoneVerificationService } from '../phone-verification/phone-verification.service';

/** Shape of data stored in the preregistered cache. */
interface PreregCacheEntry {
    data: { name: string; email: string; identification?: string; phone?: string };
    expiresAt: number;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    /** In-memory cache for preregistered player lookups (TTL: 30 min). */
    private readonly preregCache = new Map<string, PreregCacheEntry>();

    constructor(
        private jwtService: JwtService,
        private usersService: UsersService,
        private playersService: PlayersService,
        private emailService: EmailService,
        private phoneVerificationService: PhoneVerificationService,
    ) { }

    async validateUser(username: string, pass: string): Promise<any> {
        const user = await this.usersService.findOne(username);

        if (!user) {
            return null;
        }

        const isPasswordValid = await bcrypt.compare(pass, user.password);

        if (isPasswordValid) {
            const { password, ...result } = user;
            return result;
        }

        return null;
    }

    async login(user: any) {
        if (!user) {
            throw new UnauthorizedException();
        }

        // Check email verification
        if (!user.isEmailVerified) {
            throw new ForbiddenException('Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.');
        }

        const payload = {
            username: user.email,
            sub: user.id,
            role: user.role,
            playerId: user.playerId || (user.player ? user.player.id : null)
        };

        // Build club roles array for the response
        const clubRoles = (user.clubRoles || []).map((ucr: any) => ({
            clubId: ucr.clubId,
            clubName: ucr.club?.name || '',
            role: ucr.role,
        }));

        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                username: user.email,
                role: user.role,
                playerId: payload.playerId,
                clubRoles,
            }
        };
    }

    async register(dto: RegisterDto) {
        // 1. Validate phone verification token
        const verifiedPhone = this.phoneVerificationService.validateVerificationToken(dto.phoneVerificationToken);

        // 2. Ensure the verified phone matches the submitted phone
        if (verifiedPhone !== dto.phone) {
            throw new UnauthorizedException('El teléfono verificado no coincide con el registrado.');
        }

        // 3. If a preregisteredCacheKey is provided, retrieve the original (real) data from cache
        let cachedData: PreregCacheEntry['data'] | null = null;
        if (dto.preregisteredCacheKey) {
            const entry = this.preregCache.get(dto.preregisteredCacheKey);
            if (entry && entry.expiresAt > Date.now()) {
                cachedData = entry.data;
            }
            // Consume the key regardless
            this.preregCache.delete(dto.preregisteredCacheKey);
        }

        // 4. Check if user email already exists
        const existingUser = await this.usersService.findOne(dto.email);
        if (existingUser) {
            throw new ConflictException('Ya existe un usuario con ese email');
        }

        // 5. Look up pre-registered player — prefer cached original email/identification
        //    in case the user submitted a masked value
        const lookupEmail = cachedData?.email || dto.email;
        const lookupIdentification = cachedData?.identification || dto.identification;

        let player = await this.playersService.findPreregisteredByEmailOrIdentification(
            lookupEmail,
            lookupIdentification,
        );

        if (!player) {
            // Create a new player using user-provided data
            player = await this.playersService.create({
                name: dto.name || cachedData?.name || '',
                email: dto.email,
                identification: dto.identification || cachedData?.identification,
                phone: dto.phone,
                clubIds: dto.clubId ? [dto.clubId] : [],
            });
        } else {
            // Update existing pre-registered player with phone (and optionally name if user changed it)
            await this.playersService.updatePhone(player.id, dto.phone);
        }

        // 5. Generate email verification token
        const verificationToken = randomUUID();

        // 6. Create user linked to player
        const user = await this.usersService.create({
            email: dto.email,
            password: dto.password,
            phone: dto.phone,
            isPhoneVerified: true,
            emailVerificationToken: verificationToken,
            isEmailVerified: false,
        } as any);

        // 7. Link user to player
        await this.usersService.linkUserToPlayer(user.id, player.id);

        // 8. Consume verification token (one-time use)
        this.phoneVerificationService.consumeVerificationToken(dto.phoneVerificationToken);

        // 9. Send verification email
        await this.emailService.sendVerificationEmail(dto.email, verificationToken);

        return {
            message: 'Registro exitoso. Te enviamos un email de verificación. Revisa tu bandeja de entrada para activar tu cuenta.',
        };
    }

    /**
     * Check if a player has been pre-registered by an admin.
     * Returns MASKED data so the frontend can show a recognition banner,
     * and stores originals in a short-lived server-side cache (30 min).
     * The cacheKey is returned so the client can reference the originals during registration.
     */
    async checkPreregistered(email?: string, identification?: string): Promise<{
        found: boolean;
        cacheKey?: string;
        masked?: { name: string; email: string; identification?: string; phone?: string };
    }> {
        if (!email && !identification) {
            return { found: false };
        }

        // Clean expired entries
        const now = Date.now();
        for (const [key, entry] of this.preregCache) {
            if (entry.expiresAt <= now) this.preregCache.delete(key);
        }

        const player = await this.playersService.findPreregisteredByEmailOrIdentification(email, identification);
        if (!player) {
            return { found: false };
        }

        // Store the real data under a one-time key
        const cacheKey = randomUUID();
        const realData = {
            name: player.name,
            email: player.email,
            identification: player.identification,
            phone: (player as any).phone ?? null,
        };
        this.preregCache.set(cacheKey, {
            data: realData,
            expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
        });

        return {
            found: true,
            cacheKey,
            masked: {
                name: this.maskName(player.name),
                email: this.maskEmail(player.email),
                identification: player.identification ? this.maskIdentification(player.identification) : undefined,
                phone: (player as any).phone ? this.maskPhone((player as any).phone) : undefined,
            },
        };
    }

    // ── Masking utilities ────────────────────────────────────────────────────

    /** Mask each word: keep first 2 chars + `*` in middle + last char. */
    private maskName(name: string): string {
        return name.split(' ').map(word => {
            if (word.length <= 2) return word;
            if (word.length <= 4) return word[0] + '*'.repeat(word.length - 2) + word.slice(-1);
            return word.slice(0, 2) + '*'.repeat(word.length - 3) + word.slice(-1);
        }).join(' ');
    }

    /** Mask phone: keep first 4 chars + `*` in middle + last 2. */
    private maskPhone(phone: string): string {
        if (!phone || phone.length < 6) return phone ?? '';
        const visibleStart = Math.min(4, Math.floor(phone.length / 3));
        const visibleEnd = 2;
        const middle = phone.length - visibleStart - visibleEnd;
        return phone.slice(0, visibleStart) + '*'.repeat(Math.max(middle, 1)) + phone.slice(-visibleEnd);
    }

    /** Mask email: keep first 2 + last 2 of local part; keep first + last of domain. */
    private maskEmail(email: string): string {
        const atIdx = email.lastIndexOf('@');
        if (atIdx < 0) return email;
        const local = email.slice(0, atIdx);
        const domain = email.slice(atIdx + 1);

        const maskedLocal = local.length <= 3
            ? local[0] + '*'.repeat(Math.max(local.length - 1, 1))
            : local.slice(0, 2) + '*'.repeat(Math.max(local.length - 4, 1)) + local.slice(-2);

        const dotIdx = domain.lastIndexOf('.');
        const domainName = dotIdx > 0 ? domain.slice(0, dotIdx) : domain;
        const tld = dotIdx > 0 ? domain.slice(dotIdx) : '';
        const maskedDomain = domainName.length <= 2
            ? '*'.repeat(domainName.length)
            : domainName[0] + '*'.repeat(Math.max(domainName.length - 2, 1)) + domainName.slice(-1);

        return `${maskedLocal}@${maskedDomain}${tld}`;
    }

    /** Mask identification: show only last 2 characters. */
    private maskIdentification(id: string): string {
        if (!id || id.length < 3) return id ?? '';
        return '*'.repeat(id.length - 2) + id.slice(-2);
    }

    async verifyEmail(token: string): Promise<{ message: string }> {
        const user = await this.usersService.findByVerificationToken(token);
        if (!user) {
            throw new UnauthorizedException('Token de verificación inválido o expirado');
        }

        await this.usersService.markEmailVerified(user.id);

        return { message: 'Email verificado correctamente. Ya puedes iniciar sesión.' };
    }

    async resendVerification(email: string): Promise<{ message: string }> {
        const user = await this.usersService.findOne(email);
        if (!user) {
            // Don't reveal whether email exists
            return { message: 'Si el email existe, se enviará un nuevo correo de verificación.' };
        }
        if (user.isEmailVerified) {
            return { message: 'Tu cuenta ya está verificada. Puedes iniciar sesión.' };
        }

        const newToken = randomUUID();
        await this.usersService.updateVerificationToken(user.id, newToken);
        await this.emailService.sendVerificationEmail(email, newToken);

        return { message: 'Si el email existe, se enviará un nuevo correo de verificación.' };
    }
}
