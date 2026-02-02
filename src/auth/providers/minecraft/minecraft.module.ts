import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MinecraftAuthService } from './minecraft.service';
import { MinecraftModule } from 'src/minecraft/minecraft.module';

@Module({
    providers: [MinecraftAuthService],
    imports: [forwardRef(() => AuthModule), MinecraftModule],
    exports: [MinecraftAuthService]
})
export class MinecraftAuthModule {}
