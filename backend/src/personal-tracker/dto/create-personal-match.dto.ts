import { IsDateString, IsString, IsArray, ValidateNested, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class SetScoreDto {
    @IsNumber()
    set: number;

    @IsNumber()
    myScore: number;

    @IsNumber()
    rivalScore: number;

    @IsBoolean()
    @IsOptional()
    tieBreak?: boolean;
}

export class CreatePersonalMatchDto {
    @IsDateString()
    date: Date;

    @IsString()
    partnerId: string;

    @IsString()
    rival1Id: string;

    @IsString()
    rival2Id: string;

    @IsString()
    @IsOptional()
    clubId?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SetScoreDto)
    sets: SetScoreDto[];
}
