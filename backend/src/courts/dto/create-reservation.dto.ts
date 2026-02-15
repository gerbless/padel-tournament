import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';

export class CreateReservationDto {
    @IsString()
    courtId: string;

    @IsString()
    clubId: string;

    @IsString()
    date: string; // YYYY-MM-DD

    @IsString()
    startTime: string;

    @IsString()
    endTime: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsArray()
    players?: string[];

    @IsOptional()
    @IsNumber()
    playerCount?: number;

    @IsOptional()
    @IsString()
    priceType?: string;

    @IsOptional()
    @IsNumber()
    finalPrice?: number;

    @IsOptional()
    @IsString()
    paymentStatus?: string;

    @IsOptional()
    @IsString()
    paymentNotes?: string;
}
