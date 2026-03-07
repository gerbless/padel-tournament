import { IsString, IsOptional, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class EnabledModulesDto {
    @IsOptional() @IsBoolean() dashboard?: boolean;
    @IsOptional() @IsBoolean() tournaments?: boolean;
    @IsOptional() @IsBoolean() leagues?: boolean;
    @IsOptional() @IsBoolean() courts?: boolean;
    @IsOptional() @IsBoolean() players?: boolean;
    @IsOptional() @IsBoolean() ranking?: boolean;
    @IsOptional() @IsBoolean() estadisticas?: boolean;
}

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

    @IsOptional()
    @IsBoolean()
    enablePaymentLinkSending?: boolean;

    @IsOptional()
    @IsBoolean()
    enablePhoneVerification?: boolean;

    @IsOptional()
    @IsBoolean()
    enablePayments?: boolean;

    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => EnabledModulesDto)
    enabledModules?: EnabledModulesDto;
}
