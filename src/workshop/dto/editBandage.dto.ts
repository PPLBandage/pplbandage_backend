import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    MinLength
} from 'class-validator';

export class EditBandageDto {
    @IsString({ message: 'Поле `title` должно иметь тип string' })
    @MinLength(1, { message: 'Заголовок должен быть длиннее 1 символа' })
    @MaxLength(50, { message: 'Заголовок слишком длинный (макс. 50 символов)' })
    title?: string;

    @IsOptional()
    @IsString({ message: 'Поле `description` должно иметь тип string' })
    @MaxLength(300, {
        message: 'Описание слишком длинное (макс. 300 символов)'
    })
    description?: string;

    @IsOptional()
    @IsArray({ message: 'Поле `tags` должно иметь тип array' })
    @IsString({ each: true, message: 'Каждый тег должен быть строкой' })
    @ArrayMaxSize(10, { message: 'Максимум 10 тегов' })
    tags?: string[];

    @IsOptional()
    @IsNumber({}, { message: 'Поле `access_level` должно иметь тип number' })
    @Min(0)
    @Max(2)
    access_level?: number;

    @IsOptional()
    @IsBoolean({ message: 'Поле `colorable` должно иметь тип boolean' })
    colorable?: boolean;
}

export class BandageModerationDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(10)
    type!: string;

    @IsString()
    @MaxLength(200)
    message!: string;

    @IsBoolean()
    @IsNotEmpty()
    is_final!: boolean;

    @IsBoolean()
    @IsNotEmpty()
    is_hides!: boolean;
}
