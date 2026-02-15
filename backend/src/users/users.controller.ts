import { Controller, Post, Body, Get, Delete, UseGuards, Param, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    /**
     * Register a new user
     * POST /users/register
     * Body: { email: string, password: string, role?: string }
     */
    @Post('register')
    async register(@Body() body: { email: string; password: string; role?: string }) {
        return this.usersService.create({
            email: body.email,
            password: body.password,
            role: body.role || 'user',
        });
    }

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
     * Get all users (for admin purposes) — passwords excluded
     * GET /users
     */
    @UseGuards(JwtAuthGuard)
    @Get()
    async getAllUsers() {
        return this.usersService.findAll();
    }

    /**
     * Get current user's profile (with club roles)
     * GET /users/me
     */
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@Req() req: any) {
        const user = await this.usersService.findById(req.user.userId);
        if (!user) return null;
        const { password, ...rest } = user as any;
        return rest;
    }

    // ─── Club Role Endpoints ─────────────────────────────────

    /**
     * Get all users with roles for a specific club
     * GET /users/club/:clubId/members
     */
    @UseGuards(JwtAuthGuard)
    @Get('club/:clubId/members')
    async getClubUsers(@Param('clubId') clubId: string) {
        return this.usersService.getClubUsers(clubId);
    }

    /**
     * Assign a club role to a user
     * POST /users/:userId/club-roles
     * Body: { clubId: string, role: string }
     */
    @UseGuards(JwtAuthGuard)
    @Post(':userId/club-roles')
    async assignClubRole(
        @Param('userId') userId: string,
        @Body() body: { clubId: string; role: string }
    ) {
        return this.usersService.assignClubRole(userId, body.clubId, body.role);
    }

    /**
     * Remove a user's role for a specific club
     * DELETE /users/:userId/club-roles/:clubId
     */
    @UseGuards(JwtAuthGuard)
    @Delete(':userId/club-roles/:clubId')
    async removeClubRole(
        @Param('userId') userId: string,
        @Param('clubId') clubId: string
    ) {
        return this.usersService.removeClubRole(userId, clubId);
    }

    /**
     * Get all club roles for a specific user
     * GET /users/:userId/club-roles
     */
    @UseGuards(JwtAuthGuard)
    @Get(':userId/club-roles')
    async getClubRoles(@Param('userId') userId: string) {
        return this.usersService.getClubRoles(userId);
    }
}
