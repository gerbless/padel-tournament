import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaguesService } from './leagues.service';
import { LeaguesController } from './leagues.controller';
import { League } from './entities/league.entity';
import { LeagueTeam } from './entities/league-team.entity';
import { LeagueMatch } from './entities/league-match.entity';
import { PlayersModule } from '../players/players.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([League, LeagueTeam, LeagueMatch]),
        PlayersModule
    ],
    controllers: [LeaguesController],
    providers: [LeaguesService],
    exports: [LeaguesService]
})
export class LeaguesModule { }
