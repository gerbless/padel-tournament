import { IsArray, ValidateNested, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class TiebreakDto {
    @IsInt()
    @Min(0)
    team1Points: number;

    @IsInt()
    @Min(0)
    team2Points: number;
}

class SetResultDto {
    @IsInt()
    @Min(0)
    team1Games: number;

    @IsInt()
    @Min(0)
    team2Games: number;

    @IsOptional()
    @ValidateNested()
    @Type(() => TiebreakDto)
    tiebreak?: TiebreakDto;
}

export class UpdateMatchScoreDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SetResultDto)
    sets: SetResultDto[];
}
