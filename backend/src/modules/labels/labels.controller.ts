import { Body, Controller, Post, Req, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { LabelsService, UploadedFile as Uploaded } from './labels.service.js';
import { ImageImportDto } from './dto/image-import.dto.js';
import { ExcelConfirmDto } from './dto/excel-confirm.dto.js';

@Controller('labels')
@UseGuards(AccessAuthGuard)
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post('import/image')
  @UseInterceptors(FilesInterceptor('files'))
  async importImages(@Req() req: Request & { user?: any }, @UploadedFiles() files: Uploaded[], @Body() dto: ImageImportDto) {
    const userId = req.user?.sub;
    return this.labelsService.importImages(userId, files ?? [], dto.meta);
  }

  @Post('import/excel')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@Req() req: Request & { user?: any }, @UploadedFile() file: Uploaded) {
    const userId = req.user?.sub;
    return this.labelsService.createExcelPreview(userId, file);
  }

  @Post('import/excel/confirm')
  async confirmExcel(@Req() req: Request & { user?: any }, @Body() dto: ExcelConfirmDto) {
    const userId = req.user?.sub;
    return this.labelsService.confirmPreview(userId, dto.previewId);
  }
}
