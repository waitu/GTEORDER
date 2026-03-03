import { Module } from '@nestjs/common';

import { BarcodesController } from './barcodes.controller.js';
import { BarcodesService } from './barcodes.service.js';

@Module({
  controllers: [BarcodesController],
  providers: [BarcodesService],
})
export class BarcodesModule {}
