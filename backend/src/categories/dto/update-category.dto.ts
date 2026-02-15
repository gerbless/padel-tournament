import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateCategoryDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    level?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    minPoints?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    maxPoints?: number;
}
