
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(private jwtService: JwtService) { }

    async validateUser(username: string, pass: string): Promise<any> {
        // Hardcoded admin user for demonstration
        // In a real app, you'd lookup in a database and verify hased password
        if (username === 'admin' && pass === 'admin123') {
            const { ...result } = { userId: 1, username: 'admin', role: 'admin' };
            return result;
        }
        return null;
    }

    async login(user: any) {
        if (!user) {
            throw new UnauthorizedException();
        }
        const payload = { username: user.username, sub: user.userId, role: user.role };
        return {
            access_token: this.jwtService.sign(payload),
            user: { username: user.username, role: user.role }
        };
    }
}
