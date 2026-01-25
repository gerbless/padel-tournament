import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { Tournament } from './entities/tournament.entity';
import { Team } from '../teams/entities/team.entity';
import { Match } from '../matches/entities/match.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Tournament, Team, Match])],
    controllers: [TournamentsController],
    providers: [TournamentsService],
    exports: [TournamentsService],
})
export class TournamentsModule { }
