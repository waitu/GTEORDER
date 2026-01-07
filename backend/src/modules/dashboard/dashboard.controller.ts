import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';

import { UsersService } from '../users/users.service.js';
import { DeviceService } from '../devices/device.service.js';
import { LoginAudit } from '../auth/login-audit.entity.js';
import { Order, OrderType } from '../orders/order.entity.js';
import { BalanceService } from '../../shared/balance/balance.service.js';
import { BalanceTransaction } from '../../shared/balance/balance-transaction.entity.js';
import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { RegistrationRequest } from '../admin/registration-request.entity.js';

@Controller()
@UseGuards(AccessAuthGuard)
export class DashboardController {
  private readonly sampleTrackings = [
    { id: 'trk-1', tracking: '1Z999AA10123456784', status: 'in_transit', price: 12.5, updatedAt: new Date(Date.now() - 1000 * 60 * 10) },
    { id: 'trk-2', tracking: '1Z999AA10123456785', status: 'pending', price: 8.75, updatedAt: new Date(Date.now() - 1000 * 60 * 60) },
    { id: 'trk-3', tracking: '1Z999AA10123456786', status: 'delivered', price: 5.2, updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5) },
    { id: 'trk-4', tracking: '1Z999AA10123456787', status: 'in_transit', price: 6.8, updatedAt: new Date(Date.now() - 1000 * 60 * 80) },
    { id: 'trk-5', tracking: '1Z999AA10123456788', status: 'pending', price: 9.1, updatedAt: new Date(Date.now() - 1000 * 60 * 150) },
    { id: 'trk-6', tracking: '1Z999AA10123456789', status: 'cancelled', price: 4.35, updatedAt: new Date(Date.now() - 1000 * 60 * 300) },
    { id: 'trk-7', tracking: '1Z999AA10123456790', status: 'in_transit', price: 11.0, updatedAt: new Date(Date.now() - 1000 * 60 * 15) },
    { id: 'trk-8', tracking: '1Z999AA10123456791', status: 'delivered', price: 7.45, updatedAt: new Date(Date.now() - 1000 * 60 * 200) },
    { id: 'trk-9', tracking: '1Z999AA10123456792', status: 'pending', price: 10.25, updatedAt: new Date(Date.now() - 1000 * 60 * 50) },
    { id: 'trk-10', tracking: '1Z999AA10123456793', status: 'in_transit', price: 13.0, updatedAt: new Date(Date.now() - 1000 * 60 * 25) },
    { id: 'trk-11', tracking: '1Z999AA10123456794', status: 'cancelled', price: 6.0, updatedAt: new Date(Date.now() - 1000 * 60 * 400) },
    { id: 'trk-12', tracking: '1Z999AA10123456795', status: 'delivered', price: 5.9, updatedAt: new Date(Date.now() - 1000 * 60 * 360) },
  ];

  private readonly sampleEmptyOrders = [
    { id: 'emp-1', tracking: 'EMPTY-001', price: 3.5, shipping: 'created', labelLink: 'https://labels.example.com/EMPTY-001.pdf', updatedAt: new Date(Date.now() - 1000 * 60 * 30) },
    { id: 'emp-2', tracking: 'EMPTY-002', price: 4.0, shipping: 'shipping', labelLink: 'https://labels.example.com/EMPTY-002.pdf', updatedAt: new Date(Date.now() - 1000 * 60 * 120) },
    { id: 'emp-3', tracking: 'EMPTY-003', price: 5.2, shipping: 'picked_up', labelLink: 'https://labels.example.com/EMPTY-003.pdf', updatedAt: new Date(Date.now() - 1000 * 60 * 75) },
    { id: 'emp-4', tracking: 'EMPTY-004', price: 2.95, shipping: 'completed', labelLink: 'https://labels.example.com/EMPTY-004.pdf', updatedAt: new Date(Date.now() - 1000 * 60 * 15) },
  ];

  constructor(
    private readonly usersService: UsersService,
    private readonly deviceService: DeviceService,
    @InjectRepository(LoginAudit)
    private readonly loginAuditRepo: Repository<LoginAudit>,
    @InjectRepository(RegistrationRequest)
    private readonly registrationRepo: Repository<RegistrationRequest>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    private readonly balanceService: BalanceService,
    @InjectRepository(BalanceTransaction)
    private readonly txRepo: Repository<BalanceTransaction>,
  ) {}

  @Get('dashboard/summary')
  async getSummary(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');

    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const [devices, registration] = await Promise.all([
      this.deviceService.listDevicesForUser(userId),
      this.registrationRepo.findOne({ where: { user: { id: userId } as any }, order: { createdAt: 'DESC' } }),
    ]);

    const activeTrackings = this.sampleTrackings.filter((t) => t.status !== 'Delivered').length;
    const emptyOrders = this.sampleEmptyOrders.length;
    const balance = 42.75;

    return {
      activeTrackings,
      emptyOrders,
      balance,
      // keep a few account details useful to the UI if needed
      email: user.email,
      status: user.status,
      registrationStatus: registration?.state ?? null,
      trustedDevices: devices.length,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  @Get('dashboard/activity')
  async getActivity(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');

    // Query recent orders for this user (active tracking and empty package)
    const orders = await this.ordersRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .andWhere('o.order_type IN (:...types)', { types: [OrderType.ACTIVE_TRACKING, OrderType.EMPTY_PACKAGE] })
      .orderBy('o.updated_at', 'DESC')
      .limit(50)
      .getMany();

    const combined = orders.map((o) => ({
      id: o.id,
      type: o.orderType === OrderType.EMPTY_PACKAGE ? ('empty-order' as const) : ('tracking' as const),
      ref: o.trackingCode ?? o.id,
      status: o.orderStatus,
      amount: o.totalCost,
      updatedAt: o.updatedAt,
    }));

    return combined.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
  }

  @Get('trackings')
  async getTrackings(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');
    return this.sampleTrackings.map((t) => ({ ...t, updatedAt: t.updatedAt.toISOString() }));
  }

  @Get('empty-orders')
  async getEmptyOrders(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');
    return this.sampleEmptyOrders.map((o) => ({ ...o, updatedAt: o.updatedAt.toISOString() }));
  }

  @Get('balance')
  async getBalance(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');
    const balance = await this.balanceService.getBalance(userId);
    const transactions = await this.txRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.order', 'order')
      .where('tx.user_id = :userId', { userId })
      .orderBy('tx.created_at', 'DESC')
      .limit(50)
      .getMany();

    return {
      balance,
      transactions: transactions.map((t) => ({ id: t.id, description: t.reason ?? t.reference ?? '', amount: t.amount, date: t.createdAt.toISOString() })),
    };
  }
}
