import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserClubRole } from './entities/user-club-role.entity';
import { Player } from '../players/entities/player.entity';
import { Club } from '../clubs/entities/club.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User, UserClubRole, Player, Club])],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
