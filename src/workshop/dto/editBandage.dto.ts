import {
    IsArray,
    IsBoolean,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
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
    @IsArray({ message: 'Поле `categories` должно иметь тип array' })
    @IsNumber(
        {},
        { each: true, message: 'Поле `categories` должно иметь тип number[]' }
    )
    categories?: number[];

    @IsOptional()
    @IsNumber({}, { message: 'Поле `access_level` должно иметь тип number' })
    access_level?: number;

    @IsOptional()
    @IsBoolean({ message: 'Поле `colorable` должно иметь тип boolean' })
    colorable!: boolean;
}

export class BandageModerationDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(10)
    type!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    message!: string;

    @IsBoolean()
    @IsNotEmpty()
    is_final!: boolean;

    @IsBoolean()
    @IsNotEmpty()
    is_hides!: boolean;
}
