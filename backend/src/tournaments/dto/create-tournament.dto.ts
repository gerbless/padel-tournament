import { IsString, IsEnum, IsArray, ValidateNested, IsNotEmpty, IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TournamentType, DurationMode } from '../entities/tournament.entity';

class TeamDto {
    @IsString()
    @IsNotEmpty()
    player1Name: string;

    @IsString()
    @IsNotEmpty()
    player2Name: string;

    @IsInt()
    @Min(1)
    groupNumber: number;
}

export class CreateTournamentDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsEnum(TournamentType)
    type?: TournamentType;

    @IsInt()
    @Min(1)
    @Max(10)
    courts: number;

    @IsEnum(DurationMode)
    durationMode: DurationMode;

    @IsOptional()
    @IsInt()
    @Min(30)
    durationMinutes?: number;

    @IsInt()
    @Min(0)
    matchesPerTeam: number;

    @IsInt()
    @Min(1)
    totalGroups: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TeamDto)
    teams: TeamDto[];

    @IsOptional()
    @IsUUID()
    clubId?: string;

    @IsOptional()
    config?: {
        strictScoring?: boolean;
        allowTies?: boolean;
        pointsForWin?: number;
        pointsForTie?: number;
        pointsForLoss?: number;
    };
}
