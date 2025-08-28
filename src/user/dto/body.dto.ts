import {
    IsBoolean,
    IsIn,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
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

    @IsOptional()
    @Matches(/^#([0-9A-Fa-f]{3}){1,2}$/)
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

    @IsBoolean()
    @IsOptional()
    minecraft_main_page_skin?: boolean;
}

export class FeedbackDTO {
    @IsString()
    @IsNotEmpty()
    @MaxLength(1500)
    content!: string;
}
