import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';

import { Label, LabelImportType, LabelServiceType, LabelStatus } from './label.entity.js';
import { LabelPreviewService } from './label-preview.service.js';
import { ScanQueueService } from '../orders/scan-queue.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { LabelStorageService } from '../orders/label-storage.service.js';
import { AdminListLabelsDto } from './dto/admin-list-labels.dto.js';

export type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

type ImageMeta = {
  serviceType?: string;
  trackingNumber?: string;
  carrier?: string;
  clientRequestId?: string;
  sourceFileName?: string;
};

type ParsedRow = {
  labelFileUrl: string;
  serviceType: LabelServiceType;
  trackingNumber?: string | null;
  carrier?: string | null;
  clientRequestId?: string | null;
  sourceFileName?: string | null;
  status: 'valid' | 'invalid';
  error?: string;
};

@Injectable()
export class LabelsService {
  constructor(
    @InjectRepository(Label) private readonly labelsRepo: Repository<Label>,
    private readonly previewService: LabelPreviewService,
    private readonly queue: ScanQueueService,
    private readonly storage: LabelStorageService,
    private readonly ordersService: OrdersService,
  ) {}

  private normalizeServiceType(value?: string | null): LabelServiceType | null {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (['scan', 'scan_label'].includes(normalized)) return LabelServiceType.SCAN;
    if (normalized.includes('active')) return LabelServiceType.ACTIVE;
    if (normalized.includes('empty')) return LabelServiceType.EMPTY;
    return null;
  }

  private normalizeDefaultServiceType(value?: string | null): LabelServiceType | null {
    if (!value) return null;
    const normalized = value.toLowerCase().trim();
    if (normalized === 'active' || normalized === 'active_tracking') return LabelServiceType.ACTIVE;
    if (normalized === 'empty' || normalized === 'empty_package') return LabelServiceType.EMPTY;
    if (normalized === 'scan' || normalized === 'scan_label') return LabelServiceType.SCAN;
    return null;
  }

  private validateRow(base: ParsedRow): ParsedRow {
    if (!base.serviceType) {
      return { ...base, status: 'invalid', error: 'serviceType required' };
    }
    if (!base.labelFileUrl?.trim()) {
      return { ...base, status: 'invalid', error: 'labelFileUrl required' };
    }
    // Carrier is fixed to USPS; users no longer provide it.
    const withCarrier: ParsedRow = { ...base, carrier: (base.carrier?.trim() ? base.carrier : 'USPS') };
    // Scan is temporarily disabled.
    if (withCarrier.serviceType === LabelServiceType.SCAN) {
      return { ...withCarrier, status: 'invalid', error: 'Scan is temporarily disabled' };
    }
    if (!withCarrier.trackingNumber?.trim()) {
      return { ...withCarrier, status: 'invalid', error: 'trackingNumber required' };
    }
    return { ...withCarrier, status: 'valid', error: undefined };
  }

  private buildMetaMap(metaJson?: string): ImageMeta[] {
    if (!metaJson) return [];
    try {
      const parsed = JSON.parse(metaJson);
      if (Array.isArray(parsed)) return parsed as ImageMeta[];
      return [];
    } catch (error) {
      return [];
    }
  }

  private normalizeKeys(row: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const safeKey = key?.toString().trim().toLowerCase();
      if (!safeKey) continue;
      normalized[safeKey] = value;
    }
    return normalized;
  }

  private firstValue(row: Record<string, any>, keys: string[]): any {
    for (const key of keys) {
      const value = row[key];
      if (value === undefined || value === null) continue;
      const text = value.toString().trim();
      if (text.length === 0) continue;
      return value;
    }
    return undefined;
  }

  async importImages(userId: string, files: UploadedFile[], metaJson?: string) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    const metas = this.buildMetaMap(metaJson);
    const results = { total: files.length, accepted: 0, rejected: [] as { index: number; reason: string }[], labelIds: [] as string[] };

    let exhausted = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = metas[i] ?? {};
      const serviceType = this.normalizeServiceType(meta.serviceType) ?? LabelServiceType.SCAN;
      const row = this.validateRow({
        labelFileUrl: '',
        serviceType,
        trackingNumber: meta.trackingNumber ?? null,
        carrier: 'USPS',
        clientRequestId: meta.clientRequestId ?? null,
        sourceFileName: meta.sourceFileName ?? file.originalname,
        status: 'invalid',
      });

      const allowedMime = ['application/pdf', 'image/png', 'image/jpeg'];
      if (!allowedMime.includes(file.mimetype)) {
        results.rejected.push({ index: i, reason: 'Unsupported file type' });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        results.rejected.push({ index: i, reason: 'File too large' });
        continue;
      }

      const labelFileUrl = await this.storage.saveLabel(userId, file);
      const validated = this.validateRow({ ...row, labelFileUrl });
      if (validated.status === 'invalid') {
        results.rejected.push({ index: i, reason: validated.error ?? 'Invalid row' });
        continue;
      }

      const existing = validated.clientRequestId
        ? await this.labelsRepo.findOne({ where: { user: { id: userId } as any, clientRequestId: validated.clientRequestId, importType: LabelImportType.IMAGE } })
        : null;
      if (existing) {
        results.labelIds.push(existing.id);
        continue;
      }

      const entity = this.labelsRepo.create({
        user: { id: userId } as any,
        importType: LabelImportType.IMAGE,
        serviceType: validated.serviceType,
        labelFileUrl: validated.labelFileUrl,
        trackingNumber: validated.trackingNumber ?? null,
        carrier: 'USPS',
        status: LabelStatus.PENDING,
        sourceFileName: validated.sourceFileName,
        clientRequestId: validated.clientRequestId ?? null,
      });
      const saved = await this.labelsRepo.save(entity);
      results.accepted += 1;
      results.labelIds.push(saved.id);

      // create an order for this label so UI can show it immediately
      const order = await this.ordersService.createOrderFromLabel(saved as any);

      // Successful imports should auto-deduct when possible; otherwise keep order unpaid.
      if (!exhausted) {
        try {
          const res = await this.ordersService.autoPayOrderIfPossible(userId, order.id);
          if (!res.paid) exhausted = true;
        } catch {
          // Do not fail import due to payment errors.
        }
      }

      await this.queue.enqueue({
        kind: 'label',
        jobId: randomUUID(),
        labelId: saved.id,
        orderId: order.id,
        userId,
        serviceType: saved.serviceType,
        labelUrl: saved.labelFileUrl,
        trackingCode: saved.trackingNumber ?? null,
        carrier: saved.carrier ?? null,
        attempts: 0,
        clientRequestId: saved.clientRequestId ?? null,
      });
    }

    return results;
  }

  async createExcelPreview(userId: string, file: UploadedFile, defaultServiceType?: string) {
    if (!file) throw new BadRequestException('File required');
    const defaultService = this.normalizeDefaultServiceType(defaultServiceType);
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException('No sheet found');
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = (XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as unknown) as Record<string, any>[];

    const normalizedRows: Record<string, any>[] = rows
      .map((r: Record<string, any>) => this.normalizeKeys(r))
      .filter((r: Record<string, any>) => Object.values(r).some((v) => v !== undefined && v !== null && v.toString().trim().length > 0));

    const parsed: ParsedRow[] = normalizedRows.map((row: Record<string, any>) => {
      const serviceValue = (this.firstValue(row, ['servicetype', 'type', 'service']) ?? '').toString().trim();
      const serviceTypeNormalized = this.normalizeServiceType(serviceValue) ?? (!serviceValue ? defaultService : null);
      const labelFileUrl = (this.firstValue(row, ['label', 'url', 'labelfileurl']) ?? '').toString().trim();
      const trackingNumber = (this.firstValue(row, ['trackingnumber', 'tracking number', 'tracking']))?.toString() ?? '';
      const clientRequestId = this.firstValue(row, ['clientrequestid', 'requestid'])?.toString() || undefined;
      const sourceFileName = this.firstValue(row, ['sourcefilename', 'filename'])?.toString() || undefined;

      // Provide clearer errors when serviceType is missing/unknown.
      if (!serviceValue) {
        if (defaultService) {
          return this.validateRow({
            labelFileUrl,
            serviceType: defaultService,
            trackingNumber,
            carrier: 'USPS',
            clientRequestId,
            sourceFileName,
            status: 'invalid',
          });
        }
        return {
          labelFileUrl,
          serviceType: LabelServiceType.ACTIVE,
          trackingNumber,
          carrier: 'USPS',
          clientRequestId,
          sourceFileName,
          status: 'invalid',
          error: 'serviceType required',
        };
      }
      if (!serviceTypeNormalized) {
        return {
          labelFileUrl,
          serviceType: LabelServiceType.ACTIVE,
          trackingNumber,
          carrier: 'USPS',
          clientRequestId,
          sourceFileName,
          status: 'invalid',
          error: 'serviceType must be active or empty',
        };
      }

      return this.validateRow({
        labelFileUrl,
        serviceType: serviceTypeNormalized,
        trackingNumber,
        carrier: 'USPS',
        clientRequestId,
        sourceFileName,
        status: 'invalid',
      });
    });

    const preview = this.previewService.createPreview(userId, parsed);
    const validCount = parsed.filter((p) => p.status === 'valid').length;
    const errors = parsed
      .map((p, idx) => ({ ...p, index: idx }))
      .filter((p) => p.status === 'invalid')
      .map((p) => ({ row: p.index + 1, reason: p.error ?? 'Invalid row' }));

    return {
      previewId: preview.id,
      total: parsed.length,
      validCount,
      errors,
      previewSample: parsed.slice(0, 10),
    };
  }

  async confirmPreview(userId: string, previewId: string) {
    const preview = await this.previewService.getPreview(userId, previewId);
    if (!preview) throw new BadRequestException('Preview not found or expired');

    const labelIds: string[] = [];
    const paidOrderIds: string[] = [];
    const unpaidOrderIds: string[] = [];
    let created = 0;
    let failed = 0;

    let exhausted = false;
    for (const row of preview.rows) {
      if (row.status === 'invalid') {
        failed += 1;
        continue;
      }
      const existing = row.clientRequestId
        ? await this.labelsRepo.findOne({ where: { user: { id: userId } as any, clientRequestId: row.clientRequestId, importType: LabelImportType.EXCEL } })
        : null;
      if (existing) {
        labelIds.push(existing.id);
        continue;
      }
      const entity = this.labelsRepo.create({
        user: { id: userId } as any,
        importType: LabelImportType.EXCEL,
        serviceType: row.serviceType,
        labelFileUrl: row.labelFileUrl,
        trackingNumber: row.trackingNumber ?? null,
        carrier: 'USPS',
        status: LabelStatus.PENDING,
        sourceFileName: row.sourceFileName ?? null,
        clientRequestId: row.clientRequestId ?? null,
      });
      const saved = await this.labelsRepo.save(entity);
      labelIds.push(saved.id);
      created += 1;
      // create an order for this label so the admin UI can see it immediately
      const order = await this.ordersService.createOrderFromLabel(saved as any);

      // Successful imports should auto-deduct when possible; otherwise keep order unpaid.
      if (!exhausted) {
        try {
          const res = await this.ordersService.autoPayOrderIfPossible(userId, order.id);
          if (res.paid) {
            paidOrderIds.push(order.id);
          } else {
            unpaidOrderIds.push(order.id);
            exhausted = true;
          }
        } catch {
          unpaidOrderIds.push(order.id);
          exhausted = true;
          // Do not fail import due to payment errors.
        }
      } else {
        unpaidOrderIds.push(order.id);
      }

      await this.queue.enqueue({
        kind: 'label',
        jobId: randomUUID(),
        labelId: saved.id,
        orderId: order.id,
        userId,
        serviceType: saved.serviceType,
        labelUrl: saved.labelFileUrl,
        trackingCode: saved.trackingNumber ?? null,
        carrier: saved.carrier ?? null,
        attempts: 0,
        clientRequestId: saved.clientRequestId ?? null,
      });
    }

    await this.previewService.delete(previewId);

    return { created, failed, labelIds, paidOrderIds, unpaidOrderIds };
  }

  async adminList(dto: AdminListLabelsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    const qb = this.labelsRepo.createQueryBuilder('l').leftJoinAndSelect('l.user', 'user');
    if (dto.status) qb.andWhere('l.status = :status', { status: dto.status });
    if (dto.serviceType) qb.andWhere('l.serviceType = :serviceType', { serviceType: dto.serviceType });
    if (dto.userEmail) qb.andWhere('LOWER(user.email) LIKE :email', { email: `%${dto.userEmail.toLowerCase()}%` });
    qb.orderBy('l.createdAt', 'DESC').skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async adminGet(id: string) {
    const label = await this.labelsRepo.findOne({ where: { id }, relations: ['user'] });
    if (!label) throw new BadRequestException('Label not found');
    return label;
  }

  async adminUpdateStatus(id: string, status: LabelStatus, errorReason?: string | null) {
    const label = await this.labelsRepo.findOne({ where: { id } });
    if (!label) throw new BadRequestException('Label not found');
    label.status = status;
    if (errorReason !== undefined) label.errorReason = errorReason;
    return this.labelsRepo.save(label);
  }

  async adminUpdateNote(id: string, errorReason?: string | null) {
    const label = await this.labelsRepo.findOne({ where: { id } });
    if (!label) throw new BadRequestException('Label not found');
    label.errorReason = errorReason ?? null;
    return this.labelsRepo.save(label);
  }
}
