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

    // Create order and attempt to consume credits within a transaction.
    // If balance is insufficient, keep the order as UNPAID.
    const saved = await this.dataSource.transaction(async (manager) => {
      const rawKey = dto.designSubtype.replace(/\s+/g, '_').toLowerCase();
      const serviceKey = (() => {
        // frontend may send aliases (e.g. poster)
        if (rawKey === 'poster' || rawKey === 'canvas' || rawKey === 'canvas_print') return 'poster_canvas';
        if (rawKey === 'emb_text') return 'embroidery_text';
        if (rawKey === 'emb_image' || rawKey === 'emb_family' || rawKey === 'emb_pet') return 'embroidery_image';
        return rawKey;
      })();

      const expectedCost = await this.creditService.getCostForService(serviceKey);

      const draft = manager.create(Order, {
        user: { id: userId } as any,
        orderType: OrderType.DESIGN,
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        totalCost: expectedCost,
        trackingCode: null,
        carrier: null,
        designSubtype: dto.designSubtype,
        assetUrls: dto.assetUrls,
        adminNote: dto.adminNote ?? null,
      } as any);

      const savedOrder = await manager.save(draft);

      // Debit using canonical pricing for design orders
      const debit = await this.creditService.tryConsume(userId, serviceKey, savedOrder.id, manager as any);
      if (debit.ok) {
        savedOrder.paymentStatus = PaymentStatus.PAID;
        await manager.save(savedOrder);
      }

      return savedOrder as Order;
    });

    return saved;
  }
}
