import { Module } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { MatchesModule } from '../matches/matches.module';
import { TeamsModule } from '../teams/teams.module';
import { PlayersModule } from '../players/players.module';
import { UsersModule } from '../users/users.module';
import { ClubRoleGuard } from '../auth/club-role.guard';

@Module({
    imports: [
        MatchesModule,
        TeamsModule,
        PlayersModule,
        UsersModule
    ],
    controllers: [TournamentsController],
    providers: [TournamentsService, ClubRoleGuard],
    exports: [TournamentsService],
})
export class TournamentsModule { }
