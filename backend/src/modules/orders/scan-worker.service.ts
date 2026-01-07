import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { setTimeout as delay } from 'timers/promises';

import { ScanQueueService, ScanJobPayload } from './scan-queue.service.js';
import { OrdersService } from './orders.service.js';
import { OrderStatus } from './order.entity.js';

@Injectable()
export class ScanWorkerService implements OnModuleInit, OnModuleDestroy {
  private running = false;
  private readonly logger = new Logger(ScanWorkerService.name);
  private readonly maxAttempts = 3;

  constructor(private readonly queue: ScanQueueService, private readonly orders: OrdersService) {}

  async onModuleInit(): Promise<void> {
    this.running = true;
    void this.loop();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
  }

  private async loop() {
    while (this.running) {
      const job = await this.queue.dequeue(5);
      if (!job) {
        continue;
      }
      try {
        await this.handleJob(job);
      } catch (error) {
        this.logger.error(`Job ${job.jobId} failed`, error as Error);
        if (job.attempts + 1 < this.maxAttempts) {
          await this.queue.enqueue({ ...job, attempts: job.attempts + 1 });
        } else {
          if (job.orderId) {
            await this.orders.markScanFailure(job.orderId, 'PROCESSING_ERROR', 'Exceeded retry attempts', { refund: true, userId: job.userId });
          } else {
            this.logger.warn(`Dropping job ${job.jobId} after retries (no orderId)`);
          }
        }
      }
    }
  }

  private async handleJob(job: ScanJobPayload) {
    // Simulated processing; replace with real carrier activation integration.
    await delay(250);

    // Basic success path; if tracking missing, treat as invalid label.
    if (!job.trackingCode && !job.labelUrl) {
      if (job.orderId) {
        await this.orders.markScanFailure(job.orderId, 'INVALID_INPUT', 'Missing tracking or label', { refund: true, userId: job.userId });
      } else {
        this.logger.warn(`Invalid job ${job.jobId}: missing tracking and labelUrl`);
      }
      return;
    }

    const now = new Date();
    if (job.orderId) {
      try {
        // Only auto-update the order if an admin already moved it to 'processing'.
        const order = await this.orders.getOrderById(job.orderId);
        if (order.orderStatus === OrderStatus.PROCESSING) {
          await this.orders.markScanSuccess(job.orderId, {
            trackingCode: job.trackingCode ?? job.labelUrl ?? undefined,
            trackingUrl: job.trackingCode ? `https://track.example.com/${encodeURIComponent(job.trackingCode)}` : null,
            activatedAt: now,
            firstCheckpointAt: now,
          });
        } else {
          this.logger.log(`Job ${job.jobId} linked to order ${job.orderId} has status '${order.orderStatus}'; skipping automatic completion until admin marks it processing`);
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch or update order ${job.orderId} for job ${job.jobId}: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn(`Processed job ${job.jobId} missing orderId — skipping order update`);
    }
  }
}
