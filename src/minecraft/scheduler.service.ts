
import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MinecraftService } from "./minecraft.service";

@Injectable()
export class MinecraftScheduler {
    constructor(private readonly minecraftService: MinecraftService) { }

    @Cron('0 0 0 * * *')
    async scheduleSkinRevalidate() {
        console.info('Skin revalidating started');

        await this.minecraftService.revalidateSkins(1000);
    }
}