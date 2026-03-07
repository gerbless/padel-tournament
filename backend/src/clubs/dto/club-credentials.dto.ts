import { IsOptional, IsString, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SmtpCredentialsDto {
    @IsOptional() @IsString() host?: string;
    @IsOptional() @IsNumber() port?: number;
    @IsOptional() @IsString() user?: string;
    @IsOptional() @IsString() pass?: string;
    @IsOptional() @IsString() from?: string;
}

export class TwilioCredentialsDto {
    @IsOptional() @IsString() accountSid?: string;
    @IsOptional() @IsString() authToken?: string;
    @IsOptional() @IsString() whatsappFrom?: string;
}

export class MercadoPagoCredentialsDto {
    @IsOptional() @IsString() accessToken?: string;
    @IsOptional() @IsString() publicKey?: string;
    @IsOptional() @IsString() notificationUrl?: string;
}

export class UpdateClubCredentialsDto {
    @IsOptional() @ValidateNested() @Type(() => SmtpCredentialsDto)
    smtp?: SmtpCredentialsDto;

    @IsOptional() @ValidateNested() @Type(() => TwilioCredentialsDto)
    twilio?: TwilioCredentialsDto;

    @IsOptional() @ValidateNested() @Type(() => MercadoPagoCredentialsDto)
    mercadopago?: MercadoPagoCredentialsDto;
}

export interface ResolvedSmtpCreds {
    host: string; port: number; user: string; pass: string; from: string;
}

export interface ResolvedTwilioCreds {
    accountSid: string; authToken: string; whatsappFrom: string;
}

export interface ResolvedMpCreds {
    accessToken: string; publicKey: string; notificationUrl?: string;
}
