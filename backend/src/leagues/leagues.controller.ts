import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { League } from './entities/league.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('leagues')
export class LeaguesController {
    constructor(private readonly leaguesService: LeaguesService) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    create(@Body() createLeagueDto: CreateLeagueDto) {
        return this.leaguesService.create(createLeagueDto);
    }

    @Get()
    findAll(@Query('clubId') clubId?: string) {
        return this.leaguesService.findAll(clubId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.leaguesService.findOne(id);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    update(@Param('id') id: string, @Body() updateLeagueDto: any) { // TODO: Use UpdateLeagueDto
        return this.leaguesService.update(id, updateLeagueDto);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.leaguesService.remove(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/teams')
    addTeam(@Param('id') id: string, @Body() body: { player1Id: string; player2Id: string }) {
        return this.leaguesService.addTeam(id, body.player1Id, body.player2Id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/fixtures')
    generateFixtures(@Param('id') id: string) {
        return this.leaguesService.generateFixtures(id);
    }

    // New endpoint: Generate complete schedule (same as fixtures but named for frontend consistency)
    @UseGuards(JwtAuthGuard)
    @Post(':id/generate-schedule')
    generateSchedule(@Param('id') id: string) {
        return this.leaguesService.generateFixtures(id);
    }

    // New endpoint: Suggest next match
    @Get(':id/suggest-next-match')
    suggestNextMatch(@Param('id') id: string) {
        return this.leaguesService.suggestNextMatch(id);
    }

    @Get(':id/standings')
    getStandings(@Param('id') id: string) {
        return this.leaguesService.getStandings(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/groups')
    generateGroups(@Param('id') id: string, @Body() body: { numberOfGroups: number }) {
        return this.leaguesService.generateGroups(id, body.numberOfGroups);
    }

    // Updated endpoint to match frontend expectations
    @UseGuards(JwtAuthGuard)
    @Patch(':id/matches/:matchId/result')
    updateMatchResult(
        @Param('id') leagueId: string,
        @Param('matchId') matchId: string,
        @Body() body: { sets: any[]; winnerPairId: string; pointsAwarded: any; completedAt: Date }
    ) {
        return this.leaguesService.updateMatchResult(matchId, body.sets, body.winnerPairId);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/complete')
    completeLeague(@Param('id') id: string) {
        return this.leaguesService.completeLeague(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/tie-breaker')
    generateTieBreaker(@Param('id') id: string) {
        return this.leaguesService.generateTieBreakerMatches(id);
    }
}
