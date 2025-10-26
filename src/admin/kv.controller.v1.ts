import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from 'src/decorators/access.decorator';
import { Auth } from 'src/decorators/auth.decorator';
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { AuthEnum, RolesEnum } from 'src/interfaces/types';
import { KVDataBase } from 'src/prisma/kv.service';
import { CreateKvDTO, DeleteKvDTO } from './dto/kv.dto';

@Controller({ version: '1', path: 'admin/kv' })
@UseGuards(AuthGuard, RolesGuard)
export class KvController {
    constructor(private readonly kvService: KVDataBase) {}

    @Get()
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.ManageKV])
    async getKvList() {
        /** Get all KV keys */

        return await this.kvService.getAll();
    }

    @Post()
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.ManageKV])
    async createKv(@Body() body: CreateKvDTO) {
        /** Create record */

        await this.kvService.set(body.key, body.value);
    }

    @Delete()
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.ManageKV])
    async deleteKv(@Body() body: DeleteKvDTO) {
        /** Delete record */

        await this.kvService.delete(body.key);
    }
}
