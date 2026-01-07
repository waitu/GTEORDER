import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderType, OrderStatus, PaymentStatus } from '../orders/order.entity.js';
import { DesignStorageService } from './design-storage.service.js';
import { CreditService } from '../credit/credit.service.js';

import { CreateDesignDto } from './dto/create-design.dto.js';

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class DesignsService {
  constructor(
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    private readonly storage: DesignStorageService,
    private readonly dataSource: DataSource,
    private readonly creditService: CreditService,
  ) {}

  async uploadAssets(userId: string, files: UploadedFile[]) {
    if (!files || files.length === 0) throw new BadRequestException('No files uploaded');
    const urls: string[] = [];
    for (const f of files) {
      const url = await this.storage.saveDesign(userId, f as any);
      urls.push(url);
    }
    return { urls };
  }

  async createDesignOrder(userId: string, dto: CreateDesignDto) {
    if (!dto.designSubtype || typeof dto.designSubtype !== 'string' || dto.designSubtype.trim().length === 0) {
      throw new BadRequestException('designSubtype is required');
    }
    if (!Array.isArray(dto.assetUrls) || dto.assetUrls.length < 1) {
      throw new BadRequestException('At least one assetUrl is required');
    }

    // Create order and immediately consume credits within a transaction
    const saved = await this.dataSource.transaction(async (manager) => {
      const draft = manager.create(Order, {
        user: { id: userId } as any,
        orderType: OrderType.DESIGN,
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        trackingCode: null,
        carrier: null,
        designSubtype: dto.designSubtype,
        assetUrls: dto.assetUrls,
        adminNote: dto.adminNote ?? null,
      } as any);

      const savedOrder = await manager.save(draft);

      // Debit using canonical pricing for design orders
      const serviceKey = `design_${dto.designSubtype.replace(/\s+/g, '_').toLowerCase()}`;
      await this.creditService.consume(userId, serviceKey, savedOrder.id, manager as any);

      return savedOrder as Order;
    });

    return saved;
  }
}
