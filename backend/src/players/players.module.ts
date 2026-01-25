import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayersService } from './players.service';
import { PlayersController } from './players.controller';
import { Player } from './entities/player.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Player])],
    controllers: [PlayersController],
    providers: [PlayersService],
    exports: [PlayersService]
})
export class PlayersModule { }
