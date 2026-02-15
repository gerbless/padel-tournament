import { IsString, IsOptional, IsBoolean } from 'class-validator';

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

    @IsOptional()
    @IsBoolean()
    enableCourtPricing?: boolean;
}
