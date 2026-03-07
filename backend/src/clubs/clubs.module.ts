import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubsService } from './clubs.service';
import { ClubsController } from './clubs.controller';
import { Club } from './entities/club.entity';
import { Player } from '../players/entities/player.entity';
import { UsersModule } from '../users/users.module';
import { ClubRoleGuard } from '../auth/club-role.guard';
import { ClubCredentialsService } from './club-credentials.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Club, Player]),
        UsersModule,
    ],
    controllers: [ClubsController],
    providers: [ClubsService, ClubRoleGuard, ClubCredentialsService],
    exports: [ClubsService, ClubCredentialsService]
})
export class ClubsModule { }

