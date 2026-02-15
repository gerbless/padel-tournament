
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private jwtService: JwtService,
        private usersService: UsersService
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
}
