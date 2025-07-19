import {
    IsBoolean,
    IsIn,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min
} from 'class-validator';
import { avatar_providers } from 'src/avatars/avatars.service';

export class UpdateUsersDto {
    @IsOptional()
    @IsBoolean()
    banned?: boolean;

    @IsOptional()
    @IsBoolean()
    skip_ppl_check?: boolean;
}

export class UpdateSelfUserDto {
    @IsNumber()
    @IsOptional()
    @Min(0)
    @Max(2)
    theme?: number;

    @IsBoolean()
    @IsOptional()
    skin_autoload?: boolean;

    @IsBoolean()
    @IsOptional()
    nick_search?: boolean;

    @IsBoolean()
    @IsOptional()
    public?: boolean;

    @IsOptional()
    @IsIn(avatar_providers)
    prefer_avatar?: string;
}

export class FeedbackDTO {
    @IsString()
    @IsNotEmpty()
    @MaxLength(1500)
    content!: string;
}

