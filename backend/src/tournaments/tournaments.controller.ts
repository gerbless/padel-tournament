import { Controller, Get, Post, Body, Param, Delete, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('tournaments')
export class TournamentsController {
    constructor(private readonly tournamentsService: TournamentsService) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    create(@Body() createTournamentDto: CreateTournamentDto) {
        return this.tournamentsService.create(createTournamentDto);
    }

    @Get()
    findAll(@Query('clubId') clubId?: string) {
        return this.tournamentsService.findAll(clubId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.tournamentsService.findOne(id);
    }

    @Get(':id/standings')
    getStandings(@Param('id') id: string) {
        return this.tournamentsService.getStandings(id);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string) {
        return this.tournamentsService.remove(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/close')
    close(@Param('id') id: string) {
        return this.tournamentsService.closeTournament(id);
    }
}
