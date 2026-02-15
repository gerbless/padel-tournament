import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaguesService } from './leagues.service';
import { LeaguesController } from './leagues.controller';
import { League } from './entities/league.entity';
import { LeagueTeam } from './entities/league-team.entity';
import { LeagueMatch } from './entities/league-match.entity';
import { PlayersModule } from '../players/players.module';
import { UsersModule } from '../users/users.module';
import { ClubRoleGuard } from '../auth/club-role.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([League, LeagueTeam, LeagueMatch]),
        PlayersModule,
        UsersModule
    ],
    controllers: [LeaguesController],
    providers: [LeaguesService, ClubRoleGuard],
    exports: [LeaguesService]
})
export class LeaguesModule { }
