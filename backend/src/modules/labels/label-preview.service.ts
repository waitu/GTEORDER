import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { RedisService } from '../../shared/redis/redis.service.js';
import { LabelServiceType } from './label.entity.js';

type PreviewRow = {
  labelFileUrl: string;
  serviceType: LabelServiceType;
  trackingNumber?: string | null;
  carrier?: string | null;
  clientRequestId?: string | null;
  sourceFileName?: string | null;
  status: 'valid' | 'invalid';
  error?: string;
};

export type LabelPreview = {
  id: string;
  userId: string;
  rows: PreviewRow[];
  createdAt: number;
  expiresAt: number;
};

@Injectable()
export class LabelPreviewService {
  private readonly keyPrefix = 'preview:labels:';
  private readonly ttlSeconds = 60 * 60; // 1 hour

  constructor(private readonly redis: RedisService) {}

  createPreview(userId: string, rows: PreviewRow[]): LabelPreview {
    const id = randomUUID();
    const now = Date.now();
    const preview: LabelPreview = {
      id,
      userId,
      rows,
      createdAt: now,
      expiresAt: now + this.ttlSeconds * 1000,
    };
    const client = this.redis.getClient();
    void client.setex(this.key(id), this.ttlSeconds, JSON.stringify(preview));
    return preview;
  }

  async getPreview(userId: string, previewId: string): Promise<LabelPreview | null> {
    const raw = await this.redis.getClient().get(this.key(previewId));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as LabelPreview;
      if (parsed.userId !== userId) return null;
      if (parsed.expiresAt < Date.now()) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  async delete(previewId: string): Promise<void> {
    await this.redis.getClient().del(this.key(previewId));
  }

  private key(id: string) {
    return `${this.keyPrefix}${id}`;
  }
}
