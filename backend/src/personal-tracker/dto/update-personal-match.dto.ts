import { IsArray, ValidateNested, IsOptional, IsNumber, IsBoolean, IsString } from 'class-validator';
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

export class UpdatePersonalMatchDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SetScoreDto)
    @IsOptional()
    sets?: SetScoreDto[];

    @IsString()
    @IsOptional()
    status?: 'draft' | 'in_progress' | 'completed';
}
