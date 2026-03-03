import { IsString, IsNotEmpty, IsOptional, IsEmail, MinLength } from 'class-validator';

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsOptional()
    @IsString()
    identification?: string;

    @IsOptional()
    @IsString()
    clubId?: string;
}
