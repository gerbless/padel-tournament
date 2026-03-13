import { Module } from '@nestjs/common';
import { CourtsService } from './courts.service';
import { CourtsController } from './courts.controller';
import { UsersModule } from '../users/users.module';
import { PlayersModule } from '../players/players.module';
import { ClubsModule } from '../clubs/clubs.module';
import { PaymentsModule } from '../payments/payments.module';
import { ClubRoleGuard } from '../auth/club-role.guard';

@Module({
    imports: [
        UsersModule,
        PlayersModule,
        ClubsModule,
        PaymentsModule,
    ],
    controllers: [CourtsController],
    providers: [CourtsService, ClubRoleGuard],
    exports: [CourtsService]
})
export class CourtsModule { }
