import { IsOptional, IsString } from 'class-validator';

export class QueryDto {
    @IsString()
    @IsOptional()
    q?: string;
}
