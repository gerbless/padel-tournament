import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MercadoPagoPayment } from './entities/mercadopago-payment.entity';
import { Reservation } from '../courts/entities/reservation.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([MercadoPagoPayment, Reservation]),
    ],
    controllers: [PaymentsController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})
export class PaymentsModule {}
