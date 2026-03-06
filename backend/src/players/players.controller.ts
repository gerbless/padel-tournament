import { Controller, Get, Post, Delete, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubRoleGuard } from '../auth/club-role.guard';
import { ClubRoles } from '../auth/club-roles.decorator';

@Controller('players')
export class PlayersController {
    constructor(private readonly playersService: PlayersService) { }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Post()
    create(@Body() createPlayerDto: CreatePlayerDto) {
        return this.playersService.create(createPlayerDto);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Post('recalculate-all')
    async recalculateAll() {
        const result = await this.playersService.findAll();
        const players = Array.isArray(result) ? result : result.data;
        const playerIds = players.map(p => p.id);
        await this.playersService.recalculateTotalPoints(playerIds);
        return { message: 'All player points recalculated successfully' };
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Post('migrate-club-stats')
    async migrateClubStats() {
        const result = await this.playersService.findAll();
        const players = Array.isArray(result) ? result : result.data;
        const playerIds = players.map(p => p.id);
        await this.playersService.recalculateTotalPoints(playerIds);

        return {
            message: 'Club stats migration completed successfully',
            playersProcessed: playerIds.length
        };
    }

    @Get()
    findAll(@Query('clubId') clubId?: string, @Query() pagination?: PaginationQueryDto) {
        return this.playersService.findAll(clubId, pagination);
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

    @Get('ranking/free-play')
    getFreePlayRanking(@Query('categoryId') categoryId?: string, @Query('clubId') clubId?: string) {
        return this.playersService.getFreePlayRanking(categoryId, clubId);
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

    // ── Player Self-Service Profile ──

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMyProfile(@Request() req) {
        return this.playersService.findOne(req.user.playerId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('me')
    async updateMyProfile(@Request() req, @Body() dto: UpdatePlayerDto) {
        return this.playersService.update(req.user.playerId, dto);
    }

    /**
     * GET /players/:id/contact-status
     * Returns verified contact info for a player (admin/editor use).
     */
    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Get(':id/contact-status')
    getContactStatus(@Param('id') id: string) {
        return this.playersService.getContactStatus(id);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.playersService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Patch(':id')
    update(@Param('id') id: string, @Body() updatePlayerDto: UpdatePlayerDto) {
        return this.playersService.update(id, updatePlayerDto);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.playersService.remove(id);
    }
}
