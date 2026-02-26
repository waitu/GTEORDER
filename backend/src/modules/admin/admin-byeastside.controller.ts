import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { AdminAuthGuard } from './admin-auth.guard.js';
import { AdminByeastsideService } from './admin-byeastside.service.js';
import { RunByeastsideSyncDto, UpdateByeastsideSettingsDto } from './dto/byeastside-settings.dto.js';
import { ListByeastsideHistoryDto } from './dto/list-byeastside-history.dto.js';

@Controller('admin/byeastside')
@UseGuards(AdminAuthGuard)
export class AdminByeastsideController {
  constructor(private readonly service: AdminByeastsideService) {}

  @Get('settings')
  async getSettings() {
    return this.service.getSettings();
  }

  @Post('settings')
  @HttpCode(HttpStatus.OK)
  async updateSettings(@Body() body: UpdateByeastsideSettingsDto) {
    return this.service.updateSettings(body);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncNow(@Body() body: RunByeastsideSyncDto, @Req() req: Request & { user?: any }) {
    return this.service.syncNow(body, req.user?.sub);
  }

  @Get('history')
  async listHistory(@Query() query: ListByeastsideHistoryDto) {
    return this.service.listHistory(query);
  }
}
