import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteKvDTO {
    @IsString()
    @IsNotEmpty()
    key!: string;
}

export class CreateKvDTO extends DeleteKvDTO {
    @IsString()
    @IsNotEmpty()
    value!: string;
}
