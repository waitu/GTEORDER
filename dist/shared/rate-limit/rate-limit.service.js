var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';
let RateLimitService = class RateLimitService {
    constructor(redis) {
        this.redis = redis;
    }
    async consume(params) {
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
        const count = res?.[2]?.[1] ?? 0;
        if (count > params.limit) {
            throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
        }
    }
};
RateLimitService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [RedisService])
], RateLimitService);
export { RateLimitService };
//# sourceMappingURL=rate-limit.service.js.map