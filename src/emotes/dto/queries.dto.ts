import { IsNotEmpty, IsString } from 'class-validator';

export class QueryDto {
    @IsString()
    @IsNotEmpty()
    q!: string;
}
