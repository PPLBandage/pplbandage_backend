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
}

export class UpdateSelfUserDto {
    @IsNumber()
    @IsOptional()
    @Min(0)
    @Max(2)
    profile_theme?: number;

    @IsString()
    @IsOptional()
    @MaxLength(7)
    theme_color?: string;

    @IsBoolean()
    @IsOptional()
    minecraft_skin_autoload?: boolean;

    @IsBoolean()
    @IsOptional()
    minecraft_nick_searchable?: boolean;

    @IsBoolean()
    @IsOptional()
    public_profile?: boolean;

    @IsOptional()
    @IsIn(avatar_providers)
    preferred_avatar?: string;
}

export class FeedbackDTO {
    @IsString()
    @IsNotEmpty()
    @MaxLength(1500)
    content!: string;
}
