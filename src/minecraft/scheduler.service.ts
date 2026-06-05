import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MinecraftService } from './minecraft.service';

@Injectable()
export class MinecraftScheduler {
    private readonly logger = new Logger(MinecraftScheduler.name);
    constructor(private readonly minecraftService: MinecraftService) {}

    @Cron(CronExpression.EVERY_3_HOURS)
    async scheduleSkinRevalidate() {
        this.logger.log('Skin revalidating started');

        await this.minecraftService.revalidateSkins(100);
    }
}
