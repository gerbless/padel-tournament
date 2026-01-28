import { IsString, IsOptional } from 'class-validator';

export class UpdateClubDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    logo?: string;
}
