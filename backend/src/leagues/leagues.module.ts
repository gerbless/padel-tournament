import { Module } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { LeaguesController } from './leagues.controller';
import { PlayersModule } from '../players/players.module';
import { UsersModule } from '../users/users.module';
import { ClubRoleGuard } from '../auth/club-role.guard';

@Module({
    imports: [
        PlayersModule,
        UsersModule
    ],
    controllers: [LeaguesController],
    providers: [LeaguesService, ClubRoleGuard],
    exports: [LeaguesService]
})
export class LeaguesModule { }
