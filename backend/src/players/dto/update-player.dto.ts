import { IsOptional, IsString, IsIn, IsArray, IsUUID } from 'class-validator';

export class UpdatePlayerDto {
    @IsOptional()
    @IsString()
    categoryId?: string;

    @IsOptional()
    @IsString()
    @IsIn(['reves', 'drive', 'mixto'])
    position?: 'reves' | 'drive' | 'mixto';

    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    clubIds?: string[];
}
