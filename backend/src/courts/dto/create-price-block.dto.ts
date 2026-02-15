import { IsString, IsNumber, IsArray, IsOptional } from 'class-validator';

export class CreatePriceBlockDto {
    @IsOptional()
    @IsString()
    courtId?: string;

    @IsArray()
    daysOfWeek: number[];

    @IsString()
    startTime: string;

    @IsString()
    endTime: string;

    @IsNumber()
    priceFullCourt: number;

    @IsOptional()
    @IsNumber()
    pricePerPlayer?: number;
}
