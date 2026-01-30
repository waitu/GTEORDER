import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from './order.entity.js';
import { CreditModule } from '../credit/credit.module.js';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { LabelStorageService } from './label-storage.service.js';
import { ScanQueueService } from './scan-queue.service.js';
import { ScanWorkerService } from './scan-worker.service.js';
import { DesignsController } from '../designs/designs.controller.js';
import { DesignsService } from '../designs/designs.service.js';
import { DesignStorageService } from '../designs/design-storage.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), JwtModule.register({}), CreditModule],
  controllers: [OrdersController, DesignsController],
    providers: [OrdersService, AccessAuthGuard, ScanQueueService, ScanWorkerService, DesignsService, DesignStorageService],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
