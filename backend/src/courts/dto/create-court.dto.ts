import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateCourtDto {
    @IsString()
    clubId: string;

    @IsString()
    name: string;

    @IsNumber()
    courtNumber: number;

    @IsOptional()
    @IsString()
    surfaceType?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
