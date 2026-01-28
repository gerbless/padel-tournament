import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayersService } from './players.service';
import { PlayersController } from './players.controller';
import { Player } from './entities/player.entity';
import { PlayerClubStats } from './entities/player-club-stats.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Player, PlayerClubStats])],
    controllers: [PlayersController],
    providers: [PlayersService],
    exports: [PlayersService]
})
export class PlayersModule { }
