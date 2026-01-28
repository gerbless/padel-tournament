import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { League } from './entities/league.entity';


@Controller('leagues')
export class LeaguesController {
    constructor(private readonly leaguesService: LeaguesService) { }

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

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateLeagueDto: any) { // TODO: Use UpdateLeagueDto
        return this.leaguesService.update(id, updateLeagueDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.leaguesService.remove(id);
    }

    @Post(':id/teams')
    addTeam(@Param('id') id: string, @Body() body: { player1Id: string; player2Id: string }) {
        return this.leaguesService.addTeam(id, body.player1Id, body.player2Id);
    }

    @Post(':id/fixtures')
    generateFixtures(@Param('id') id: string) {
        return this.leaguesService.generateFixtures(id);
    }

    // New endpoint: Generate complete schedule (same as fixtures but named for frontend consistency)
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

    @Post(':id/groups')
    generateGroups(@Param('id') id: string, @Body() body: { numberOfGroups: number }) {
        return this.leaguesService.generateGroups(id, body.numberOfGroups);
    }

    // Updated endpoint to match frontend expectations
    @Patch(':id/matches/:matchId/result')
    updateMatchResult(
        @Param('id') leagueId: string,
        @Param('matchId') matchId: string,
        @Body() body: { sets: any[]; winnerPairId: string; pointsAwarded: any; completedAt: Date }
    ) {
        return this.leaguesService.updateMatchResult(matchId, body.sets, body.winnerPairId);
    }

    @Post(':id/complete')
    completeLeague(@Param('id') id: string) {
        return this.leaguesService.completeLeague(id);
    }

    @Post(':id/tie-breaker')
    generateTieBreaker(@Param('id') id: string) {
        return this.leaguesService.generateTieBreakerMatches(id);
    }
}
