
import { Controller, Request, Post, UseGuards, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

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
}
