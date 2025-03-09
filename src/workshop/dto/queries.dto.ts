import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsBooleanStr, IsDivisible, IsSort } from 'src/common/types.decorator';

export class WidthQueryDTO {
    @IsNumber()
    @Type(() => Number)
    @IsOptional()
    @Min(16)
    @Max(1024)
    @IsDivisible(16)
    width?: number;
}

export class EditQueryDTO {
    @IsBooleanStr()
    @IsOptional()
    for_edit?: string;
}

export class WorkshopSearchQueryDTO {
    @IsString()
    @IsOptional()
    search?: string;

    @IsOptional()
    @Transform(({ value }) => value.split(',').map(Number))
    @IsNumber(
        {},
        {
            each: true,
            message(validationArguments) {
                return (
                    `\`${validationArguments.property}\` property must be an array of categories IDs, ` +
                    `like \`1,2,10\`, but \`${validationArguments.value}\` was provided instead`
                );
            }
        }
    )
    filters?: number[];

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
