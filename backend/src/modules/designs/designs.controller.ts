import { Body, Controller, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { DesignsService } from './designs.service.js';
import { CreateDesignDto } from './dto/create-design.dto.js';

@Controller('designs')
@UseGuards(AccessAuthGuard)
export class DesignsController {
  constructor(private readonly designs: DesignsService) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadFiles(@Req() req: Request & { user?: any }, @UploadedFiles() files: any[]) {
    const userId = req.user?.sub;
    return this.designs.uploadAssets(userId, files as any);
  }

  @Post()
  async create(@Req() req: Request & { user?: any }, @Body() dto: CreateDesignDto) {
    const userId = req.user?.sub;
    return this.designs.createDesignOrder(userId, dto);
  }
}
