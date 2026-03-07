import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class SendOtpDto {
    /**
     * Phone number in E.164 format: +56912345678
     */
    @IsString()
    @IsNotEmpty()
    @Matches(/^\+[1-9]\d{6,14}$/, { message: 'El teléfono debe estar en formato internacional. Ejemplo: +56912345678' })
    phone: string;

    /** Optional club identifier — used to pick per-club Twilio credentials */
    @IsOptional()
    @IsString()
    clubId?: string;
}
