import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateCategoryDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsNumber()
    @Min(1)
    level: number;

    @IsNumber()
    @Min(0)
    minPoints: number;

    @IsNumber()
    @Min(0)
    maxPoints: number;
}
