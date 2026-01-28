import { IsString, IsEnum, IsArray, ValidateNested, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { TournamentType } from '../entities/tournament.entity';

class TeamDto {
    @IsString()
    @IsNotEmpty()
    player1Name: string;

    @IsString()
    @IsNotEmpty()
    player2Name: string;
}

export class CreateTournamentDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEnum(TournamentType)
    type: TournamentType;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TeamDto)
    teams: TeamDto[];

    @IsOptional()
    @IsUUID()
    clubId?: string;
}
