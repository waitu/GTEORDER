import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  Param,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  StreamableFile,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { createReadStream, promises as fs } from 'fs';

import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { CreatePingPongTopupDto } from './dto/create-pingpong-topup.dto.js';
import { CreatePingPongPackageTopupDto } from './dto/create-pingpong-package-topup.dto.js';
import { CreditTopupsService, UploadedBillImage } from './credit-topups.service.js';

@Controller('api/credits')
@UseGuards(AccessAuthGuard)
export class CreditTopupsController {
  constructor(private readonly topups: CreditTopupsService) {}

  @Post('topup/pingpong')
  @UseInterceptors(
    FileInterceptor('bill_image', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = file.mimetype === 'image/png' || file.mimetype === 'image/jpeg';
        // Do not throw here; let the service return a clear BadRequest.
        cb(null, ok);
      },
    }),
  )
  async createPingPongTopup(
    @Req() req: Request & { user?: any },
    @Body() dto: CreatePingPongTopupDto,
    @UploadedFile() billImage: UploadedBillImage,
  ) {
    const userId = req.user?.sub;
    return this.topups.createPingPongManualTopup({
      userId,
      amount: dto.amount,
      transferNote: dto.transferNote,
      note: dto.note ?? null,
      billImage,
    });
  }

  @Post('topup/pingpong/package')
  @UseInterceptors(
    FileInterceptor('bill_image', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = file.mimetype === 'image/png' || file.mimetype === 'image/jpeg';
        // Do not throw here; let the service return a clear BadRequest.
        cb(null, ok);
      },
    }),
  )
  async createPingPongPackageTopup(
    @Req() req: Request & { user?: any },
    @Body() dto: CreatePingPongPackageTopupDto,
    @UploadedFile() billImage: UploadedBillImage,
  ) {
    const userId = req.user?.sub;
    return this.topups.createPingPongPackageTopup({
      userId,
      packageKey: dto.packageKey,
      transferNote: dto.transferNote,
      note: dto.note ?? null,
      billImage,
    });
  }

  @Get('topups')
  async listMyTopups(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    return this.topups.listUserTopups(userId);
  }

  @Get('topups/:id/bill')
  async getBill(
    @Req() req: Request & { user?: any },
    @Param('id') topupId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const topup = await this.topups.getTopupForBillAccess({
      requesterId: req.user?.sub,
      requesterRole: req.user?.role,
      topupId,
    });

    const path = topup.billImageUrl;
    await fs.stat(path).catch(() => {
      throw new NotFoundException('Bill image not found');
    });

    const ext = (path.split('.').pop() || '').toLowerCase();
    const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    return new StreamableFile(createReadStream(path));
  }
}
