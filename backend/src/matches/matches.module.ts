import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { UsersModule } from '../users/users.module';
import { ClubRoleGuard } from '../auth/club-role.guard';

@Module({
    imports: [
        UsersModule
    ],
    controllers: [MatchesController],
    providers: [MatchesService, ClubRoleGuard],
    exports: [MatchesService],
})
export class MatchesModule { }
