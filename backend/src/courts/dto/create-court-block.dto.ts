import { IsString, IsOptional, IsArray, IsEnum, IsBoolean } from 'class-validator';
import { BlockType } from '../entities/court-block.entity';

export class CreateCourtBlockDto {
    @IsOptional()
    @IsString()
    clubId?: string;

    @IsString()
    startDate: string;

    @IsString()
    endDate: string;

    @IsEnum(BlockType)
    blockType: BlockType;

    @IsOptional()
    @IsString()
    customStartTime?: string;

    @IsOptional()
    @IsString()
    customEndTime?: string;

    @IsOptional()
    courtIds?: string[] | null;

    @IsOptional()
    @IsString()
    reason?: string;
}
