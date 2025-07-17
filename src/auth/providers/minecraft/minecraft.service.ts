import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
import { MinecraftService } from 'src/minecraft/minecraft.service';

@Injectable()
export class MinecraftAuthService {
    constructor(
        private prisma: PrismaService,
        private authService: AuthService,
        private minecraftService: MinecraftService
    ) {}

    /** Create session for minecraft user */
    async login(code: string, user_agent: string) {
        const user_data = await this.minecraftService.getByCode(code);
        const skin_cache = await this.minecraftService.updateSkinCache(
            user_data.UUID,
            true
        );

        let user = await this.prisma.user.findFirst({
            where: { profile: { id: skin_cache.id } },
            include: { UserSettings: true }
        });

        if (!user) {
            user = await this.authService.createUser({
                name: user_data.nickname,
                username: user_data.nickname.toLowerCase(),
                profile: { connect: { id: skin_cache.id } }
            });
        }

        const user_roles = await this.prisma.accessRoles.findMany({
            where: { users: { some: { id: user.id } } }
        });
        return await this.authService.createSession(
            user,
            user_agent,
            user_roles
        );
    }
}

