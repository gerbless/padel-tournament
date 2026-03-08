import { Controller, Get, Post, Delete, Patch, Body, Param, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { UpdateClubCredentialsDto } from './dto/club-credentials.dto';
import { ClubCredentialsService } from './club-credentials.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ClubRoleGuard } from '../auth/club-role.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { ClubRoles } from '../auth/club-roles.decorator';

@Controller('clubs')
export class ClubsController {
    constructor(
        private readonly clubsService: ClubsService,
        private readonly credentialsService: ClubCredentialsService,
    ) { }

    @UseGuards(JwtAuthGuard, SuperAdminGuard)
    @Post()
    create(@Body() createClubDto: CreateClubDto) {
        return this.clubsService.create(createClubDto);
    }

    @UseGuards(OptionalJwtAuthGuard)
    @Get()
    findAll(@Req() req: any) {
        // If the request has an authenticated super_admin, include inactive clubs
        const isSuperAdmin = req.user?.role === 'super_admin';
        return this.clubsService.findAll(isSuperAdmin);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.clubsService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Patch(':id')
    update(@Param('id') id: string, @Body() updateClubDto: UpdateClubDto) {
        return this.clubsService.update(id, updateClubDto);
    }

    @UseGuards(JwtAuthGuard, SuperAdminGuard)
    @Patch(':id/toggle-active')
    toggleActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
        return this.clubsService.setActive(id, isActive);
    }

    @UseGuards(JwtAuthGuard, SuperAdminGuard)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string) {
        return this.clubsService.remove(id);
    }

    @Get(':id/players')
    getPlayers(@Param('id') id: string) {
        return this.clubsService.getPlayers(id);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Post(':id/players/:playerId')
    @HttpCode(HttpStatus.NO_CONTENT)
    addPlayer(@Param('id') id: string, @Param('playerId') playerId: string) {
        return this.clubsService.addPlayer(id, playerId);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Delete(':id/players/:playerId')
    @HttpCode(HttpStatus.NO_CONTENT)
    removePlayer(@Param('id') id: string, @Param('playerId') playerId: string) {
        return this.clubsService.removePlayer(id, playerId);
    }

    @Get(':id/top-players')
    getTopPlayers(@Param('id') id: string) {
        return this.clubsService.getTopPlayers(id, 10);
    }

    // ─── Credentials (super_admin only) ─────────────────────────────────────

    @UseGuards(JwtAuthGuard, SuperAdminGuard)
    @Get(':id/credentials')
    getCredentials(@Param('id') id: string) {
        return this.credentialsService.getMaskedCredentials(id);
    }

    @UseGuards(JwtAuthGuard, SuperAdminGuard)
    @Patch(':id/credentials')
    @HttpCode(HttpStatus.NO_CONTENT)
    async updateCredentials(@Param('id') id: string, @Body() dto: UpdateClubCredentialsDto) {
        await this.credentialsService.updateCredentials(id, dto);
    }
}
