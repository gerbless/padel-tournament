import { Controller, Get, Post, Delete, Patch, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubRoleGuard } from '../auth/club-role.guard';
import { ClubRoles } from '../auth/club-roles.decorator';

@Controller('clubs')
export class ClubsController {
    constructor(private readonly clubsService: ClubsService) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    create(@Body() createClubDto: CreateClubDto) {
        return this.clubsService.create(createClubDto);
    }

    @Get()
    findAll() {
        return this.clubsService.findAll();
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

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
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
}
