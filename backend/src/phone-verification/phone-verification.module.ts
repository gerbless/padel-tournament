import { Module } from '@nestjs/common';
import { PhoneVerificationService } from './phone-verification.service';
import { PhoneVerificationController } from './phone-verification.controller';
import { ClubsModule } from '../clubs/clubs.module';

@Module({
    imports: [ClubsModule],
    controllers: [PhoneVerificationController],
    providers: [PhoneVerificationService],
    exports: [PhoneVerificationService],
})
export class PhoneVerificationModule {}
