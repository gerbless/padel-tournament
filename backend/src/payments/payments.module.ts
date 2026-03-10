import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Club } from '../clubs/entities/club.entity';
import { UsersModule } from '../users/users.module';
import { ClubsModule } from '../clubs/clubs.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Club]),
        UsersModule,
        ClubsModule,
    ],
    controllers: [PaymentsController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})
export class PaymentsModule {}
