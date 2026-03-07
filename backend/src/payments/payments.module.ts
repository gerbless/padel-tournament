import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MercadoPagoPayment } from './entities/mercadopago-payment.entity';
import { Reservation } from '../courts/entities/reservation.entity';
import { Club } from '../clubs/entities/club.entity';
import { UsersModule } from '../users/users.module';
import { ClubsModule } from '../clubs/clubs.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([MercadoPagoPayment, Reservation, Club]),
        UsersModule,
        ClubsModule,
    ],
    controllers: [PaymentsController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})
export class PaymentsModule {}
