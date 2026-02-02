import { Controller, Post, Body, Get, UseGuards, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    /**
     * Link a user to a player
     * POST /users/:userId/link-player
     * Body: { playerId: string }
     */
    @UseGuards(JwtAuthGuard)
    @Post(':userId/link-player')
    async linkPlayerToUser(
        @Param('userId') userId: string,
        @Body('playerId') playerId: string
    ) {
        return this.usersService.linkUserToPlayer(userId, playerId);
    }

    /**
     * Get all users (for admin purposes)
     * GET /users
     */
    @UseGuards(JwtAuthGuard)
    @Get()
    async getAllUsers() {
        return this.usersService.findAll();
    }
}
