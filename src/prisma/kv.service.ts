import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

type RecordType = Record<
    string,
    { id: number; value: string; modified: Date; created: Date }
>;

@Injectable()
export class KVDataBase {
    constructor(private prisma: PrismaService) {}

    /** Write data to KV database */
    async set(key: string, value: string) {
        await this.prisma.kV.upsert({
            where: { key: key },
            create: {
                key: key,
                value: value
            },
            update: {
                value: value,
                edited: new Date()
            }
        });
    }

    /** Get data from KV database by key */
    async get(key: string): Promise<string | null> {
        const data = await this.prisma.kV.findUnique({ where: { key: key } });
        if (!data) {
            return null;
        }

        return data.value;
    }

    /** Delete data from KV database by key */
    async delete(key: string): Promise<boolean> {
        try {
            await this.prisma.kV.delete({ where: { key: key } });
            return true;
        } catch {
            return false;
        }
    }

    /** Get all records (for API) */
    async getAll(): Promise<RecordType> {
        const records = await this.prisma.kV.findMany();
        return records.reduce((acc: RecordType, record) => {
            acc[record.key] = {
                id: record.id,
                value: record.value,
                modified: record.edited,
                created: record.created
            };
            return acc;
        }, {});
    }
}
