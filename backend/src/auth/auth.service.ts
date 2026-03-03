
import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { PlayersService } from '../players/players.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private jwtService: JwtService,
        private usersService: UsersService,
        private playersService: PlayersService,
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

        // Create user linked to player
        const user = await this.usersService.create({
            email: dto.email,
            password: dto.password,
        } as any);

        // Link user to player
        await this.usersService.linkUserToPlayer(user.id, player.id);

        // Return login response
        const fullUser = await this.usersService.findOne(dto.email);
        return this.login(fullUser);
    }
}
