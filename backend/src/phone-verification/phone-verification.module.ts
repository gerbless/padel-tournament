import { Module } from '@nestjs/common';
import { PhoneVerificationService } from './phone-verification.service';
import { PhoneVerificationController } from './phone-verification.controller';

@Module({
    controllers: [PhoneVerificationController],
    providers: [PhoneVerificationService],
    exports: [PhoneVerificationService],
})
export class PhoneVerificationModule {}
