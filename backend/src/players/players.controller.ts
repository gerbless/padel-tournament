import { Controller, Get, Post, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('players')
export class PlayersController {
    constructor(private readonly playersService: PlayersService) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    create(@Body() createPlayerDto: CreatePlayerDto) {
        return this.playersService.create(createPlayerDto);
    }

    @UseGuards(JwtAuthGuard)
    @Post('recalculate-all')
    async recalculateAll() {
        const players = await this.playersService.findAll();
        const playerIds = players.map(p => p.id);
        await this.playersService.recalculateTotalPoints(playerIds);
        return { message: 'All player points recalculated successfully' };
    }

    @UseGuards(JwtAuthGuard)
    @Post('migrate-club-stats')
    async migrateClubStats() {
        const players = await this.playersService.findAll();
        const playerIds = players.map(p => p.id);

        console.log(`[Migration] Starting migration for ${playerIds.length} players`);
        await this.playersService.recalculateTotalPoints(playerIds);

        return {
            message: 'Club stats migration completed successfully',
            playersProcessed: playerIds.length
        };
    }

    @Get()
    findAll(@Query('clubId') clubId?: string) {
        return this.playersService.findAll(clubId);
    }

    @Get('ranking')
    getRanking(@Query('categoryId') categoryId?: string, @Query('clubId') clubId?: string) {
        return this.playersService.getRanking(categoryId, clubId);
    }

    @Get('ranking/league')
    getLeagueRanking(@Query('categoryId') categoryId?: string, @Query('clubId') clubId?: string) {
        return this.playersService.getLeagueRanking(categoryId, clubId);
    }

    @Get('ranking/tournament')
    getTournamentRanking(@Query('categoryId') categoryId?: string, @Query('clubId') clubId?: string) {
        return this.playersService.getTournamentRanking(categoryId, clubId);
    }

    @Get('ranking/pairs')
    getPairRanking(@Query('type') type: 'global' | 'league' | 'tournament' = 'global', @Query('categoryId') categoryId?: string, @Query('clubId') clubId?: string) {
        return this.playersService.getPairRankings(type, categoryId, clubId);
    }

    @Get('top-global')
    getGlobalTopPlayers() {
        return this.playersService.getGlobalTopPlayers();
    }

    @Get('recommendations')
    getRecommendations(@Query('clubId') clubId?: string) {
        return this.playersService.getRecommendedMatches(clubId);
    }

    @Get('partner-recommendations')
    getPartnerRecommendations(@Query('clubId') clubId?: string) {
        return this.playersService.getAllPartnerRecommendations(clubId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.playersService.findOne(id);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    update(@Param('id') id: string, @Body() updatePlayerDto: UpdatePlayerDto) {
        return this.playersService.update(id, updatePlayerDto);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.playersService.remove(id);
    }
}
