import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, UploadedFile, UseInterceptors, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { OrdersService } from '../orders/orders.service.js';
import { ListOrdersDto } from '../orders/dto/list-orders.dto.js';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { UpdateOrderStatusDto } from '../orders/dto/update-order-status.dto.js';
import { UpdatePaymentStatusDto } from '../orders/dto/update-payment-status.dto.js';
import { UpdateOrderResultDto } from '../orders/dto/update-order-result.dto.js';
import { UpdateAdminNoteDto } from '../orders/dto/update-admin-note.dto.js';

@Controller('admin/orders')
@UseGuards(AdminAuthGuard)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async listOrders(@Query() query: ListOrdersDto) {
    return this.ordersService.listOrders(query, { includeUserEmail: true });
  }

  @Get(':id')
  async getOrder(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdateOrderStatusDto) {
    return this.ordersService.updateOrderStatus(id, body.orderStatus);
  }

  @Patch(':id/payment')
  async updatePayment(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdatePaymentStatusDto) {
    return this.ordersService.updatePaymentStatus(id, body.paymentStatus);
  }

  @Patch(':id/result')
  async updateResult(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdateOrderResultDto) {
    return this.ordersService.updateResultUrl(id, body.resultUrl);
  }

  @Patch(':id/note')
  async updateNote(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdateAdminNoteDto) {
    return this.ordersService.updateAdminNote(id, body.adminNote ?? null);
  }
  @Post('bulk/start')
  async bulkStart(@Body() body: { ids: string[] }) {
    return this.ordersService.bulkStartProcessing(body.ids || []);
  }

  @Post('bulk/fail')
  async bulkFail(@Body() body: { ids: string[]; adminNote?: string; refund?: boolean }) {
    const ids = body.ids || [];
    const note = body.adminNote ?? 'Marked failed by admin';
    const refund = Boolean(body.refund);
    return this.ordersService.bulkMarkFailed(ids, note, refund);
  }

  @Post('bulk/archive')
  async bulkArchive(@Body() body: { ids: string[] }) {
    const ids = body.ids || [];
    return this.ordersService.bulkArchive(ids);
  }

  @Post(':id/start')
  async startProcessing(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordersService.startProcessing(id);
  }

  @Post(':id/result/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadResult(@Req() req: Request & { user?: any }, @Param('id', new ParseUUIDPipe()) id: string, @UploadedFile() file: any) {
    // Admin uploads a result file for the order. Save under the order owner's folder and set resultUrl.
    const order = await this.ordersService.getOrderById(id);
    const userId = order.user?.id;
    if (!userId) throw new Error('Order has no owner');
    // Use dynamic import to avoid circular dependency at top-level
    const { DesignStorageService } = await import('../designs/design-storage.service.js');
    const storage = new DesignStorageService();
    const savedPath = await storage.saveDesign(userId, file as any);
    // set resultUrl on order
    return this.ordersService.updateResultUrl(id, savedPath);
  }
}
