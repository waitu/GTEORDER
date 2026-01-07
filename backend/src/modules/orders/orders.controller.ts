import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

import { OrdersService } from './orders.service.js';
import { ListOrdersDto } from './dto/list-orders.dto.js';
import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { ScanLabelDto } from './dto/scan-label.dto.js';

@Controller('orders')
@UseGuards(AccessAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async listOrders(@Req() req: Request & { user?: any }, @Query() query: ListOrdersDto) {
    const userId = req.user?.sub;
    return this.ordersService.listOrders({ ...query, userId });
  }

  @Get(':id')
  async getOrder(@Req() req: Request & { user?: any }, @Param('id', new ParseUUIDPipe()) id: string) {
    const userId = req.user?.sub;
    return this.ordersService.getOrderById(id, { userId });
  }

  @Post('scan-label')
  @UseInterceptors(FileInterceptor('label'))
  async scanLabel(
    @Req() req: Request & { user?: any },
    @Body() body: ScanLabelDto,
    @UploadedFile() file?: UploadedFile,
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new Error('Missing user context');
    return this.ordersService.createScanLabelOrder(userId, body, file);
  }
}
