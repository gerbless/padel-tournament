import { IsString, IsNotEmpty, IsOptional, IsEmail, MinLength, Matches } from 'class-validator';

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^\+[1-9]\d{6,14}$/, { message: 'El teléfono debe estar en formato internacional. Ejemplo: +56912345678' })
    phone: string;

    /**
     * OTP token from WhatsApp verification.
     * Optional — only required when the club has enablePhoneVerification = true.
     */
    @IsOptional()
    @IsString()
    phoneVerificationToken?: string;

    @IsOptional()
    @IsString()
    identification?: string;

    @IsOptional()
    @IsString()
    clubId?: string;

    /** Optional cache key from a previous check-preregistered call. */
    @IsOptional()
    @IsString()
    preregisteredCacheKey?: string;
}
