import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreatePlayerDto {
    @IsString()
    @IsNotEmpty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    categoryId?: string;

    @IsOptional()
    @IsString()
    @IsIn(['reves', 'drive', 'mixto'])
    position?: 'reves' | 'drive' | 'mixto';
}
