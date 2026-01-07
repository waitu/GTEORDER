import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async consume(params: { key: string; limit: number; windowSeconds: number }): Promise<void> {
    if (process.env.RATE_LIMIT_DISABLED === 'true') return;

    const client = this.redis.getClient();
    const ttlMs = params.windowSeconds * 1000;
    const now = Date.now();
    const bucketKey = `${params.key}`;

    const res = await client
      .multi()
      .zadd(bucketKey, now, String(now))
      .zremrangebyscore(bucketKey, 0, now - ttlMs)
      .zcard(bucketKey)
      .pexpire(bucketKey, ttlMs)
      .exec();
    const count = (res?.[2]?.[1] as number) ?? 0;
    if (count > params.limit) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
