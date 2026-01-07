import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { LabelsController } from './labels.controller.js';
import { LabelPreviewService } from './label-preview.service.js';
import { Label } from './label.entity.js';
import { LabelsService } from './labels.service.js';
import { ScanQueueModule } from '../scan-queue/scan-queue.module.js';
import { LabelStorageModule } from '../orders/label-storage.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { AccessAuthGuard } from '../auth/access-auth.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([Label]), JwtModule.register({}), ScanQueueModule, LabelStorageModule, OrdersModule],
  controllers: [LabelsController],
  providers: [LabelsService, LabelPreviewService, AccessAuthGuard],
  exports: [LabelsService],
})
export class LabelsModule {}
