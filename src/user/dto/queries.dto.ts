import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsBooleanStr } from 'src/common/types.decorator';

export class SetQueryDTO {
    @IsBooleanStr()
    @IsNotEmpty()
    set?: string;
}

export class PageTakeQueryDTO {
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    @Min(1)
    @Max(50)
    take?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    @Min(0)
    page?: number;
}


export class QueryDTO {
    @IsString()
    @IsOptional()
    query?: string;
}
