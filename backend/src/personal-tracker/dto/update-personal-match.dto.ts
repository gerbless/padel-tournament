import { IsArray, ValidateNested, IsOptional, IsNumber, IsBoolean, IsString, IsIn } from 'class-validator';
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
    @IsIn(['draft', 'in_progress', 'completed'])
    status?: 'draft' | 'in_progress' | 'completed';
}
