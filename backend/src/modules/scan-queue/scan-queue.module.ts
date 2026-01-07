import { Module } from '@nestjs/common';

import { ScanQueueService } from '../orders/scan-queue.service.js';

@Module({
  providers: [ScanQueueService],
  exports: [ScanQueueService],
})
export class ScanQueueModule {}
