import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, UnauthorizedException, UseGuards, HttpException } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { Request } from 'express';

import { AdminService } from './admin.service.js';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { ListRegistrationRequestsDto } from './dto/list-registration-requests.dto.js';
import { ReviewRegistrationDto } from './dto/review-registration.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { AdjustCreditDto } from './dto/adjust-credit.dto.js';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  async overview() {
    return this.adminService.getOverview();
  }

  @Get('registration-requests')
  async listRequests(@Query() query: ListRegistrationRequestsDto) {
    return this.adminService.listRegistrationRequests(query.status ?? 'pending');
  }

  @Post('registration-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReviewRegistrationDto,
    @Req() req: Request & { user?: any },
  ) {
    const adminId = req.user?.sub;
    await this.review(id, adminId, 'approved', body.reason);
    return { status: 'approved' };
  }

  @Post('registration-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReviewRegistrationDto,
    @Req() req: Request & { user?: any },
  ) {
    const adminId = req.user?.sub;
    await this.review(id, adminId, 'rejected', body.reason);
    return { status: 'rejected' };
  }

  private async review(
    requestId: string,
    adminId: string,
    decision: 'approved' | 'rejected',
    reason?: string,
  ) {
    if (!adminId) {
      throw new UnauthorizedException('Admin context missing');
    }
    try {
      await this.adminService.reviewRegistration({ requestId, adminId, decision, reason });
    } catch (err: any) {
      if (err?.message === 'Registration request not found') {
        throw new NotFoundException('Registration request not found');
      }
      throw err;
    }
  }

  @Get('audits')
  async listAudits() {
    return this.adminService.listAudits();
  }

  @Get('users')
  async listUsers() {
    return this.adminService.listUsers();
  }

  @Get('users/:id')
  async getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.adminService.getUser(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Post('users/:id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateUserStatusDto,
    @Req() req: Request & { user?: any },
  ) {
    const updated = await this.adminService.updateAccountStatus({ id, status: body.status, adminId: req.user?.sub });
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  @Post('users/:id/role')
  @HttpCode(HttpStatus.OK)
  async updateRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateUserRoleDto,
    @Req() req: Request & { user?: any },
  ) {
    const updated = await this.adminService.updateUserRole({ id, role: body.role, adminId: req.user?.sub });
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  @Post('users/:id/credit')
  @HttpCode(HttpStatus.OK)
  async adjustCredit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdjustCreditDto,
    @Req() req: Request & { user?: any },
  ) {
    const adminId = req.user?.sub;
    if (!adminId) throw new UnauthorizedException('Admin context missing');
    try {
      const newBalance = await this.adminService.adjustUserCredit(id, body, adminId);
      return { id, creditBalance: newBalance };
    } catch (err: any) {
      if (err?.message === 'User not found') throw new NotFoundException('User not found');
      if (err?.message === 'INSUFFICIENT_BALANCE') throw new HttpException('Insufficient balance', HttpStatus.BAD_REQUEST);
      throw err;
    }
  }

  @Get('users/:id/credit/transactions')
  async getUserCreditTransactions(@Param('id', new ParseUUIDPipe()) id: string) {
    // Return last 10 transactions
    const rows = await this.adminService.fetchUserCreditTransactions(id, 10);
    return rows;
  }
}