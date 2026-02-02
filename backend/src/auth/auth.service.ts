
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private usersService: UsersService
    ) { }

    async validateUser(username: string, pass: string): Promise<any> {
        // Fallback for demo if users table empty? No, let's force DB usage.
        // Wait, current migration system might need a seed.
        // I will keep the hardcoded Admin for safety if DB lookup fails, 
        // BUT prioritize DB user.

        try {
            const user = await this.usersService.findOne(username);

            if (user && user.password === pass) {
                // Return user object strictly
                const { password, ...result } = user;
                return result;
            }
        } catch (e) {
            console.warn('DB Auth failed', e);
        }

        // Hardcoded fallback for now so I don't lock myself out during dev
        if (username === 'admin@padel.com' && pass === 'admin') {
            return { id: 'admin-id', email: username, role: 'admin' };
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

        return {
            access_token: this.jwtService.sign(payload),
            user: {
                username: user.email,
                role: user.role,
                playerId: payload.playerId
            }
        };
    }
}
