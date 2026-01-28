import { IsString, IsOptional } from 'class-validator';

export class CreateClubDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    logo?: string;
}
