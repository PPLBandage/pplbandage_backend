import { IsNotEmpty, IsString } from 'class-validator';

export class CreateKvDTO {
    @IsString()
    @IsNotEmpty()
    key!: string;

    @IsString()
    @IsNotEmpty()
    value!: string;
}

export class DeleteKvDTO {
    @IsString()
    @IsNotEmpty()
    key!: string;
}
