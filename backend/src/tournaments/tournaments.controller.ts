import { Controller, Get, Post, Body, Param, Delete, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubRoleGuard } from '../auth/club-role.guard';
import { ClubRoles } from '../auth/club-roles.decorator';

@Controller('tournaments')
export class TournamentsController {
    constructor(private readonly tournamentsService: TournamentsService) { }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Post()
    create(@Body() createTournamentDto: CreateTournamentDto) {
        return this.tournamentsService.create(createTournamentDto);
    }

    @Get()
    findAll(
        @Query('clubId') clubId?: string,
        @Query('month') month?: string,
        @Query('year') year?: string,
        @Query() pagination?: PaginationQueryDto,
    ) {
        const m = month ? parseInt(month, 10) : undefined;
        const y = year ? parseInt(year, 10) : undefined;
        return this.tournamentsService.findAll(clubId, pagination, m, y);
    }

    @Get('stats/monthly')
    getMonthlyStats(
        @Query('month') month?: string,
        @Query('year') year?: string,
        @Query('clubId') clubId?: string,
    ) {
        const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
        const y = year ? parseInt(year, 10) : new Date().getFullYear();
        return this.tournamentsService.getMonthlyStats(m, y, clubId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.tournamentsService.findOne(id);
    }

    @Get(':id/standings')
    getStandings(@Param('id') id: string, @Query('group') group?: string, @Query('phase') phase?: string) {
        const groupNumber = group ? parseInt(group, 10) : undefined;
        return this.tournamentsService.getStandings(id, groupNumber, phase);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Post(':id/generate-elimination')
    generateElimination(@Param('id') id: string) {
        return this.tournamentsService.generateEliminationMatches(id);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string) {
        return this.tournamentsService.remove(id);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Post(':id/close')
    close(@Param('id') id: string) {
        return this.tournamentsService.closeTournament(id);
    }
}
