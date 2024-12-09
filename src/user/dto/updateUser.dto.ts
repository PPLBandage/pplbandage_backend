import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateUsersDto {
    @IsOptional()
    @IsBoolean()
    banned?: boolean;
}

export class UpdateSelfUserDto {
    @IsNumber()
    @IsOptional()
    @Min(0)
    @Max(2)
    theme?: number;

    @IsBoolean()
    @IsOptional()
    skin_autoload?: boolean

    @IsBoolean()
    @IsOptional()
    nick_search?: boolean

    @IsBoolean()
    @IsOptional()
    public?: boolean
}