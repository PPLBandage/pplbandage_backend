import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsDivisible, IsSort } from 'src/common/types.decorator';

export class WidthQueryDTO {
    @IsNumber()
    @Type(() => Number)
    @IsOptional()
    @Min(16)
    @Max(1024)
    @IsDivisible(16)
    width?: number;
}

export class TagQueryDto {
    @IsString()
    @IsOptional()
    q?: string;
}

export class WorkshopSearchQueryDTO {
    @IsString()
    @IsOptional()
    search?: string;

    @IsOptional()
    @IsString()
    @IsSort()
    sort?: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    @Min(1)
    @Max(100)
    take?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    @Min(0)
    page?: number;
}
