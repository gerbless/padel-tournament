import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { League } from './entities/league.entity';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubRoleGuard } from '../auth/club-role.guard';
import { ClubRoles } from '../auth/club-roles.decorator';

@Controller('leagues')
export class LeaguesController {
    constructor(private readonly leaguesService: LeaguesService) { }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Post()
    create(@Body() createLeagueDto: CreateLeagueDto) {
        return this.leaguesService.create(createLeagueDto);
    }

    @Get()
    findAll(@Query('clubId') clubId?: string, @Query() pagination?: PaginationQueryDto) {
        return this.leaguesService.findAll(clubId, pagination);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.leaguesService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Patch(':id')
    update(@Param('id') id: string, @Body() updateLeagueDto: UpdateLeagueDto) {
        return this.leaguesService.update(id, updateLeagueDto);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.leaguesService.remove(id);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Post(':id/teams')
    addTeam(@Param('id') id: string, @Body() body: { player1Id: string; player2Id: string }) {
        return this.leaguesService.addTeam(id, body.player1Id, body.player2Id);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Post(':id/fixtures')
    generateFixtures(@Param('id') id: string) {
        return this.leaguesService.generateFixtures(id);
    }

    // New endpoint: Generate complete schedule (same as fixtures but named for frontend consistency)
    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
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

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Post(':id/groups')
    generateGroups(@Param('id') id: string, @Body() body: { numberOfGroups: number }) {
        return this.leaguesService.generateGroups(id, body.numberOfGroups);
    }

    // Updated endpoint to match frontend expectations
    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Patch(':id/matches/:matchId/result')
    updateMatchResult(
        @Param('id') leagueId: string,
        @Param('matchId') matchId: string,
        @Body() body: { sets: any[]; winnerPairId: string; pointsAwarded: any; completedAt: Date }
    ) {
        return this.leaguesService.updateMatchResult(matchId, body.sets, body.winnerPairId);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Post(':id/complete')
    completeLeague(@Param('id') id: string) {
        return this.leaguesService.completeLeague(id);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Post(':id/tie-breaker')
    generateTieBreaker(@Param('id') id: string) {
        return this.leaguesService.generateTieBreakerMatches(id);
    }
}
