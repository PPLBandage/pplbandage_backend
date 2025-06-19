import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    MinLength
} from 'class-validator';

export class CreateBandageDto {
    @IsString({ message: 'Поле `base64` должно иметь тип string' })
    @IsNotEmpty({ message: 'Поле `base64` обязательно' })
    base64!: string;

    @IsOptional()
    @IsString({ message: 'Поле `base64_slim` должно иметь тип string' })
    base64_slim?: string;

    @IsString({ message: 'Поле `title` должно иметь тип string' })
    @MinLength(1, { message: 'Заголовок должен быть длиннее 1 символа' })
    @MaxLength(50, { message: 'Заголовок слишком длинный (макс. 50 символов)' })
    @IsNotEmpty({ message: 'Поле `title` обязательно' })
    title!: string;

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
    access_level?: number;

    @IsOptional()
    @IsBoolean({ message: 'Поле `split_type` должно иметь тип boolean' })
    split_type?: boolean;

    @IsNotEmpty({ message: 'Поле `colorable` обязательно' })
    @IsBoolean({ message: 'Поле `colorable` должно иметь тип boolean' })
    colorable?: boolean;
}
