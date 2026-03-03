
import { Controller, Request, Post, UseGuards, Body, UnauthorizedException, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { EmailService } from '../email/email.service';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private emailService: EmailService,
    ) { }

    @Post('login')
    async login(@Body() body: any) {
        const user = await this.authService.validateUser(body.username, body.password);
        if (!user) {
            throw new UnauthorizedException('Credenciales inválidas');
        }
        return this.authService.login(user);
    }

    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Get('verify-email')
    async verifyEmail(@Query('token') token: string) {
        return this.authService.verifyEmail(token);
    }

    @Post('resend-verification')
    async resendVerification(@Body() body: { email: string }) {
        return this.authService.resendVerification(body.email);
    }

    @Get('email-status')
    async emailStatus() {
        return this.emailService.getStatus();
    }
}
