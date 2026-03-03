
import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { UsersService } from '../users/users.service';
import { PlayersService } from '../players/players.service';
import { RegisterDto } from './dto/register.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private jwtService: JwtService,
        private usersService: UsersService,
        private playersService: PlayersService,
        private emailService: EmailService,
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
        // Check if user email already exists
        const existingUser = await this.usersService.findOne(dto.email);
        if (existingUser) {
            throw new ConflictException('Ya existe un usuario con ese email');
        }

        // Create player
        const player = await this.playersService.create({
            name: dto.name,
            email: dto.email,
            identification: dto.identification,
            clubIds: dto.clubId ? [dto.clubId] : [],
        });

        // Generate verification token
        const verificationToken = randomUUID();

        // Create user linked to player (not yet verified)
        const user = await this.usersService.create({
            email: dto.email,
            password: dto.password,
            emailVerificationToken: verificationToken,
            isEmailVerified: false,
        } as any);

        // Link user to player
        await this.usersService.linkUserToPlayer(user.id, player.id);

        // Send verification email
        await this.emailService.sendVerificationEmail(dto.email, verificationToken);

        return {
            message: 'Registro exitoso. Te enviamos un email de verificación. Revisa tu bandeja de entrada para activar tu cuenta.',
        };
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
