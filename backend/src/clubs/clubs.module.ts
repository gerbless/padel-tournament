import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubsService } from './clubs.service';
import { ClubsController } from './clubs.controller';
import { Club } from './entities/club.entity';
import { Player } from '../players/entities/player.entity';
import { UsersModule } from '../users/users.module';
import { ClubRoleGuard } from '../auth/club-role.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([Club, Player]),
        UsersModule,
    ],
    controllers: [ClubsController],
    providers: [ClubsService, ClubRoleGuard],
    exports: [ClubsService]
})
export class ClubsModule { }
