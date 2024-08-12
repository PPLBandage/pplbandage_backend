import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUsersDto {
    @IsOptional()
    @IsBoolean()
    banned?: boolean;
}