import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { AdminService } from './admin.service';
import { Auth } from 'src/decorators/auth.decorator';
import { AuthEnum, RolesEnum } from 'src/interfaces/types';
import { Roles } from 'src/decorators/access.decorator';

@Controller({ version: '1', path: 'admin' })
@UseGuards(AuthGuard, RolesGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get()
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.SuperAdmin])
    async getStats() {
        const [users_data] = await Promise.all([
            this.adminService.getUsersData()
        ]);

        return {
            users_data
        };
    }
}
