import { Controller, Get, Post, Delete, Patch, Body, Param, Query } from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Controller('players')
export class PlayersController {
    constructor(private readonly playersService: PlayersService) { }

    @Post()
    create(@Body() createPlayerDto: CreatePlayerDto) {
        return this.playersService.create(createPlayerDto);
    }

    @Post('recalculate-all')
    recalculateAll() {
        return this.playersService.recalculateAll();
    }

    @Get()
    findAll() {
        return this.playersService.findAll();
    }

    @Get('ranking')
    getRanking(@Query('categoryId') categoryId?: string) {
        return this.playersService.getRanking(categoryId);
    }

    @Get('ranking/league')
    getLeagueRanking(@Query('categoryId') categoryId?: string) {
        return this.playersService.getLeagueRanking(categoryId);
    }

    @Get('ranking/tournament')
    getTournamentRanking(@Query('categoryId') categoryId?: string) {
        return this.playersService.getTournamentRanking(categoryId);
    }

    @Get('ranking/pairs')
    getPairRanking(@Query('type') type: 'global' | 'league' | 'tournament' = 'global', @Query('categoryId') categoryId?: string) {
        return this.playersService.getPairRankings(type, categoryId);
    }

    @Get('recommendations')
    getRecommendations() {
        return this.playersService.getRecommendedMatches();
    }

    @Get('partner-recommendations')
    getPartnerRecommendations() {
        return this.playersService.getAllPartnerRecommendations();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.playersService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updatePlayerDto: UpdatePlayerDto) {
        return this.playersService.update(id, updatePlayerDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.playersService.remove(id);
    }
}
