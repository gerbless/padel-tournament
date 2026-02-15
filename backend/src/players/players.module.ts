import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayersService } from './players.service';
import { PlayerRankingService } from './player-ranking.service';
import { PlayerRecommendationService } from './player-recommendation.service';
import { PlayersController } from './players.controller';
import { Player } from './entities/player.entity';
import { PlayerClubStats } from './entities/player-club-stats.entity';
import { UsersModule } from '../users/users.module';
import { ClubRoleGuard } from '../auth/club-role.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([Player, PlayerClubStats]),
        UsersModule
    ],
    controllers: [PlayersController],
    providers: [PlayersService, PlayerRankingService, PlayerRecommendationService, ClubRoleGuard],
    exports: [PlayersService]
})
export class PlayersModule { }
