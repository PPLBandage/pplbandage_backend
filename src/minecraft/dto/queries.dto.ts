import { Type } from "class-transformer";
import { IsNumber, IsOptional, Max, Min } from "class-validator";
import { IsBooleanStr } from "src/common/types.decorator";

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