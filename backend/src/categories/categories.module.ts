import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { Category } from './entities/category.entity';
import { Player } from '../players/entities/player.entity';
import { UsersModule } from '../users/users.module';
import { ClubRoleGuard } from '../auth/club-role.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([Category, Player]),
        UsersModule
    ],
    controllers: [CategoriesController],
    providers: [CategoriesService, ClubRoleGuard],
    exports: [CategoriesService]
})
export class CategoriesModule { }
