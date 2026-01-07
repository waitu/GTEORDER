import { Controller, Get } from '@nestjs/common';
import { PricingService } from './pricing.service.js';

@Controller('pricing')
export class PricingController {
  constructor(private pricing: PricingService) {}

  @Get()
  async getPricing() {
    return this.pricing.getAll();
  }
}
