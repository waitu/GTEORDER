import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../../shared/redis/redis.service.js';

export type ScanJobPayload = {
  kind?: string;
  jobId: string;
  orderId?: string | null;
  labelId?: string | null;
  userId: string;
  carrier?: string | null;
  trackingCode?: string | null;
  labelUrl?: string | null;
  serviceType?: string | null;
  attempts: number;
  clientRequestId?: string | null;
};

@Injectable()
export class ScanQueueService implements OnModuleDestroy {
  private readonly key = 'queue:scan-label';
  private readonly logger = new Logger(ScanQueueService.name);

  constructor(private readonly redis: RedisService) {}

  async enqueue(job: ScanJobPayload): Promise<void> {
    const payload = JSON.stringify(job);
    await this.redis.getClient().lpush(this.key, payload);
  }

  async dequeue(blockSeconds = 5): Promise<ScanJobPayload | null> {
    const res = await this.redis.getClient().brpop(this.key, blockSeconds);
    if (!res) return null;
    try {
      return JSON.parse(res[1]) as ScanJobPayload;
    } catch (error) {
      this.logger.warn('Failed to parse scan job', error as Error);
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    // nothing to clean up; Redis handled globally
  }
}
