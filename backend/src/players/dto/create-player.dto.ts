import { IsString, IsNotEmpty, IsOptional, IsIn, IsArray, IsUUID, IsEmail } from 'class-validator';

export class CreatePlayerDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    identification?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

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
