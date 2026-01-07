import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingRule } from './pricing.entity.js';

@Injectable()
export class PricingService {
  constructor(@InjectRepository(PricingRule) private repo: Repository<PricingRule>) {}

  async getAll() {
    const rows = await this.repo.find();
    const serviceCreditCost: Record<string, number> = {};
    const topupPackages: Record<string, { price: number; credits: number; discount: number }> = {};

    for (const r of rows) {
      if (r.kind === 'service' && r.price != null) {
        serviceCreditCost[r.key] = Number(r.price);
      }
      if (r.kind === 'topup' && r.price != null) {
        topupPackages[r.key] = { price: Number(r.price), credits: r.credits ?? 0, discount: Number(r.discount ?? 0) };
      }
    }

    return { serviceCreditCost, topupPackages };
  }
}
