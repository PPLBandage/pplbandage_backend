import {
    ArrayMaxSize,
    IsArray,
    IsDateString,
    IsNotEmpty,
    IsNumber,
    IsString
} from 'class-validator';

export class CreateEventDTO {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsDateString()
    @IsNotEmpty()
    start_date!: Date;

    @IsDateString()
    @IsNotEmpty()
    end_date!: Date;

    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    @ArrayMaxSize(10)
    tags!: string[];

    @IsNotEmpty()
    @IsNumber()
    boost_amount!: number;
}

export class EditEventDTO extends CreateEventDTO {
    @IsNumber()
    @IsNotEmpty()
    id!: number;
}

export class DeleteEventDTO {
    @IsNumber()
    @IsNotEmpty()
    id!: number;
}
