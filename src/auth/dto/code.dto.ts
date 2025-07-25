import { IsString } from 'class-validator';

export class CodeDTO {
    @IsString()
    code!: string;
}
