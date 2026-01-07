import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';
import { PricingRule } from './pricing.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([PricingRule])],
  providers: [PricingService],
  controllers: [PricingController],
  exports: [PricingService],
})
export class PricingModule {}
