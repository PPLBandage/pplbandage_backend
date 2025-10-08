import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from 'src/decorators/access.decorator';
import { Auth } from 'src/decorators/auth.decorator';
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { AuthEnum, RolesEnum } from 'src/interfaces/types';
import { KVDataBase } from 'src/prisma/kv.service';
import { CreateKvDTO, DeleteKvDTO } from './dto/kv.dto';

@Controller({ version: '1', path: 'admin' })
@UseGuards(AuthGuard, RolesGuard)
export class AdminController {
    constructor(private readonly kvService: KVDataBase) {}

    @Get('kv')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.SuperAdmin])
    async getKvList() {
        /** Get all KV keys */

        return await this.kvService.getAll();
    }

    @Post('kv')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.SuperAdmin])
    async createKv(@Body() body: CreateKvDTO) {
        /** Create record */

        await this.kvService.set(body.key, body.value);
    }

    @Delete('kv')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.SuperAdmin])
    async deleteKv(@Body() body: DeleteKvDTO) {
        /** Delete record */

        await this.kvService.delete(body.key);
    }
}
