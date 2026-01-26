import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdatePlayerDto {
    @IsOptional()
    @IsString()
    categoryId?: string;

    @IsOptional()
    @IsString()
    @IsIn(['reves', 'drive', 'mixto'])
    position?: 'reves' | 'drive' | 'mixto';
}
