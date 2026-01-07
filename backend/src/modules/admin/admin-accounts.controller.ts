import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { AdminAuthGuard } from './admin-auth.guard.js';
import { AdminService } from './admin.service.js';
import { ListAccountsDto } from './dto/list-accounts.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';

@Controller('admin/accounts')
@UseGuards(AdminAuthGuard)
export class AdminAccountsController {
  constructor(private readonly adminService: AdminService) {}

  @Get('summary')
  async summary() {
    return this.adminService.getAccountsSummary();
  }

  @Get()
  async list(@Query() query: ListAccountsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.adminService.listAccounts({
      status: query.status,
      role: query.role,
      search: query.search,
      page,
      limit,
    });
  }

  @Get(':id')
  async detail(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.adminService.getAccountDetail(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateUserStatusDto,
    @Req() req: Request & { user?: any },
  ) {
    const updated = await this.adminService.updateAccountStatus({ id, status: body.status, adminId: req.user?.sub });
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  @Patch(':id/role')
  async updateRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateUserRoleDto,
    @Req() req: Request & { user?: any },
  ) {
    await this.adminService.updateUserRole({ id, role: body.role, adminId: req.user?.sub });
    const updated = await this.adminService.getAccountDetail(id);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }
}
