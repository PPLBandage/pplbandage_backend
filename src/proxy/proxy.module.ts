import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';

@Module({
    providers: [ProxyService],
    exports: [ProxyService]
})
export class ProxyModule {}
