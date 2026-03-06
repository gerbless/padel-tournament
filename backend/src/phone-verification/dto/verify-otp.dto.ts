import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
    @IsString()
    @IsNotEmpty()
    @Matches(/^\+[1-9]\d{6,14}$/, { message: 'El teléfono debe estar en formato internacional. Ejemplo: +56912345678' })
    phone: string;

    @IsString()
    @IsNotEmpty()
    @Length(6, 6, { message: 'El código debe tener exactamente 6 dígitos' })
    code: string;
}
