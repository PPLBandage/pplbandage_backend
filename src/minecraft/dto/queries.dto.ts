import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsBooleanStr } from 'src/common/types.decorator';

export class PageTakeQueryDTO {
    @IsString()
    q!: string;

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

export class CapeQueryDTO {
    @IsBooleanStr()
    @IsOptional()
    cape?: string;
}

export class PixelWidthQueryDTO {
    @IsNumber()
    @Type(() => Number)
    @IsOptional()
    @Min(1)
    @Max(10000)
    pixel_width?: number;
}
