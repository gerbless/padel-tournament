import { Controller, Post, Body, Query, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { PhoneVerificationService } from './phone-verification.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('phone-verification')
export class PhoneVerificationController {
    constructor(private readonly phoneVerificationService: PhoneVerificationService) {}

    /**
     * POST /phone-verification/send
     * Send a 6-digit OTP via WhatsApp to the given phone number.
     */
    @Post('send')
    @HttpCode(HttpStatus.OK)
    async sendOtp(@Body() dto: SendOtpDto & { clubName?: string }) {
        return this.phoneVerificationService.sendOtp(dto.phone, dto.clubName, dto.clubId);
    }

    /**
     * POST /phone-verification/verify
     * Verify the OTP. Returns a verificationToken to be included in the registration payload.
     */
    @Post('verify')
    @HttpCode(HttpStatus.OK)
    async verifyOtp(@Body() dto: VerifyOtpDto) {
        return this.phoneVerificationService.verifyOtp(dto.phone, dto.code);
    }
}
