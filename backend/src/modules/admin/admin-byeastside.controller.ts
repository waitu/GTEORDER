import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { AdminAuthGuard } from './admin-auth.guard.js';
import { AdminByeastsideService } from './admin-byeastside.service.js';
import { RunByeastsideSyncDto, UpdateByeastsideSettingsDto } from './dto/byeastside-settings.dto.js';

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
  async syncNow(@Body() body: RunByeastsideSyncDto) {
    return this.service.syncNow(body);
  }
}
