import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourtsService } from './courts.service';
import { CourtsController } from './courts.controller';
import { Court } from './entities/court.entity';
import { CourtPriceBlock } from './entities/court-price-block.entity';
import { Reservation } from './entities/reservation.entity';
import { UsersModule } from '../users/users.module';
import { ClubRoleGuard } from '../auth/club-role.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([Court, CourtPriceBlock, Reservation]),
        UsersModule
    ],
    controllers: [CourtsController],
    providers: [CourtsService, ClubRoleGuard],
    exports: [CourtsService]
})
export class CourtsModule { }
