import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubsService } from './clubs.service';
import { ClubsController } from './clubs.controller';
import { Club } from './entities/club.entity';
import { Player } from '../players/entities/player.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Club, Player])],
    controllers: [ClubsController],
    providers: [ClubsService],
    exports: [ClubsService]
})
export class ClubsModule { }
