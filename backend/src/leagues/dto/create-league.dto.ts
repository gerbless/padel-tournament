import { IsString, IsEnum, IsOptional, IsDateString, IsObject, ValidateNested, IsNumber, IsBoolean, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { LeagueType } from '../entities/league.entity';

class LeagueConfigDto {
    @IsOptional()
    @IsNumber()
    pointsForWin?: number;

    @IsOptional()
    @IsNumber()
    pointsForLoss?: number;

    @IsOptional()
    @IsBoolean()
    useGoldenPoint?: boolean;

    @IsOptional()
    @IsBoolean()
    enableMultiTierPlayoffs?: boolean;

    @IsOptional()
    @IsNumber()
    setsPerMatch?: number;

    @IsOptional()
    @IsNumber()
    pointsForDraw?: number;

    @IsOptional()
    @IsNumber()
    numberOfGroups?: number;

    @IsOptional()
    @IsNumber()
    teamsAdvancePerGroup?: number;

    @IsOptional()
    @IsNumber()
    gamesPerSet?: number;

    @IsOptional()
    @IsNumber()
    tiebreakAt?: number;

    @IsOptional()
    @IsBoolean()
    tiebreakInThirdSet?: boolean;

    @IsOptional()
    groups?: string[];
}

export class CreateLeagueDto {
    @IsString()
    name: string;

    @IsEnum(LeagueType)
    type: LeagueType;

    @IsOptional()
    @ValidateNested()
    @Type(() => LeagueConfigDto)
    config?: LeagueConfigDto;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsString()
    category?: string;

    // Support for pair-based creation
    @IsOptional()
    pairs?: Array<{ playerA: string; playerB: string }>;

    @IsOptional()
    @IsUUID()
    clubId?: string;
}
