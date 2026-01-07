import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { LabelsService } from '../labels/labels.service.js';
import { AdminListLabelsDto } from '../labels/dto/admin-list-labels.dto.js';
import { LabelStatus } from '../labels/label.entity.js';

class PatchStatusDto {
  status!: LabelStatus;
  errorReason?: string | null;
}

class PatchNoteDto {
  errorReason?: string | null;
}

@Controller('admin/labels')
@UseGuards(AdminAuthGuard)
export class AdminLabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get()
  async list(@Query() dto: AdminListLabelsDto) {
    return this.labels.adminList(dto);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.labels.adminGet(id);
  }

  @Patch(':id/status')
  async patchStatus(@Param('id') id: string, @Body() dto: PatchStatusDto) {
    return this.labels.adminUpdateStatus(id, dto.status, dto.errorReason ?? null);
  }

  @Patch(':id/note')
  async patchNote(@Param('id') id: string, @Body() dto: PatchNoteDto) {
    return this.labels.adminUpdateNote(id, dto.errorReason ?? null);
  }
}
