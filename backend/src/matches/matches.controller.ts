import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { UpdateMatchScoreDto } from './dto/update-match-score.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('matches')
export class MatchesController {
    constructor(private readonly matchesService: MatchesService) { }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.matchesService.findOne(id);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/score')
    updateScore(@Param('id') id: string, @Body() updateMatchScoreDto: UpdateMatchScoreDto) {
        return this.matchesService.updateScore(id, updateMatchScoreDto);
    }
}
