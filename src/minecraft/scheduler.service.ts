import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MinecraftService } from './minecraft.service';

@Injectable()
export class MinecraftScheduler {
    private readonly logger = new Logger(MinecraftScheduler.name);
    constructor(private readonly minecraftService: MinecraftService) {}

    @Cron('0 0 0 * * *')
    async scheduleSkinRevalidate() {
        this.logger.log('Skin revalidating started');

        await this.minecraftService.revalidateSkins(1000);
    }
}
