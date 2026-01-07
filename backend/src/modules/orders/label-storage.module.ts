import { Module } from '@nestjs/common';

import { LabelStorageService } from './label-storage.service.js';

@Module({
  providers: [LabelStorageService],
  exports: [LabelStorageService],
})
export class LabelStorageModule {}
