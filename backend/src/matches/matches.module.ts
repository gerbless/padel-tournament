import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { Match } from './entities/match.entity';
import { UsersModule } from '../users/users.module';
import { ClubRoleGuard } from '../auth/club-role.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([Match]),
        UsersModule
    ],
    controllers: [MatchesController],
    providers: [MatchesService, ClubRoleGuard],
    exports: [MatchesService],
})
export class MatchesModule { }
