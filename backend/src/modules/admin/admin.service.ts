import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository, IsNull, DataSource } from 'typeorm';

import { AdminAudit } from './admin-audit.entity.js';
import { RegistrationRequest, RegistrationState } from './registration-request.entity.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/user.entity.js';
import { LoginAudit } from '../auth/login-audit.entity.js';
import { UserProfile } from '../users/user-profile.entity.js';
import { RefreshToken } from '../auth/refresh-token.entity.js';
import { TrustedDevice } from '../devices/trusted-device.entity.js';
import { BalanceTransaction } from '../../shared/balance/balance-transaction.entity.js';
import { BalanceService } from '../../shared/balance/balance.service.js';
import { AdjustCreditDto } from './dto/adjust-credit.dto.js';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(RegistrationRequest)
    private readonly registrationRepo: Repository<RegistrationRequest>,
    @InjectRepository(AdminAudit)
    private readonly adminAuditRepo: Repository<AdminAudit>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(BalanceTransaction)
    private readonly txRepo: Repository<BalanceTransaction>,
    @InjectRepository(UserProfile)
    private readonly profilesRepo: Repository<UserProfile>,
    @InjectRepository(LoginAudit)
    private readonly loginAuditRepo: Repository<LoginAudit>,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    @InjectRepository(TrustedDevice)
    private readonly devicesRepo: Repository<TrustedDevice>,
    private readonly usersService: UsersService,
    private readonly balanceService: BalanceService,
    private readonly dataSource: DataSource,
  ) {}

  async createRegistrationRequest(userId: string): Promise<RegistrationRequest> {
    const existing = await this.registrationRepo.findOne({ where: { user: { id: userId } as any, state: 'pending' } });
    if (existing) return existing;

    const request = this.registrationRepo.create({ user: { id: userId } as any, state: 'pending' });
    return this.registrationRepo.save(request);
  }

  async listRegistrationRequests(state: RegistrationState = 'pending'): Promise<RegistrationRequest[]> {
    return this.registrationRepo.find({ where: { state }, relations: ['user'] });
  }

  async reviewRegistration(params: {
    requestId: string;
    adminId: string;
    decision: RegistrationState;
    reason?: string;
  }): Promise<void> {
    const request = await this.registrationRepo.findOne({ where: { id: params.requestId }, relations: ['user'] });
    if (!request) throw new Error('Registration request not found');

    request.state = params.decision;
    request.reviewedBy = { id: params.adminId } as any;
    request.reviewedAt = new Date();
    request.reason = params.reason;
    await this.registrationRepo.save(request);

    if (params.decision === 'approved') {
      await this.usersService.updateStatus(request.user.id, 'active');
    } else if (params.decision === 'rejected') {
      await this.usersService.updateStatus(request.user.id, 'rejected');
    }

    await this.adminAuditRepo.save(
      this.adminAuditRepo.create({
        admin: { id: params.adminId } as any,
        action: 'registration_review',
        targetId: params.requestId,
        payload: { decision: params.decision, reason: params.reason },
      }),
    );
  }

  async getOverview() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      registrationPending,
      registrationApproved,
      registrationRejected,
      loginSuccess24h,
      loginFail24h,
      recentUsers,
      recentRequests,
      recentAdminAudits,
    ] = await Promise.all([
      this.usersRepo.count(),
      this.usersRepo.count({ where: { status: 'active' } }),
      this.usersRepo.count({ where: { status: 'pending' } }),
      this.registrationRepo.count({ where: { state: 'pending' } }),
      this.registrationRepo.count({ where: { state: 'approved' } }),
      this.registrationRepo.count({ where: { state: 'rejected' } }),
      this.loginAuditRepo.count({ where: { result: 'success', createdAt: MoreThan(since24h) } }),
      this.loginAuditRepo.count({ where: { result: 'fail', createdAt: MoreThan(since24h) } }),
      this.usersRepo.find({ order: { createdAt: 'DESC' }, take: 5 }),
      this.registrationRepo.find({ relations: ['user'], order: { createdAt: 'DESC' }, take: 5 }),
      this.adminAuditRepo.find({ order: { createdAt: 'DESC' }, take: 5 }),
    ]);

    return {
      counts: {
        totalUsers,
        activeUsers,
        pendingUsers,
        registrationPending,
        registrationApproved,
        registrationRejected,
        loginSuccess24h,
        loginFail24h,
      },
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        email: u.email,
        status: u.status,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })),
      recentRequests: recentRequests.map((r) => ({
        id: r.id,
        email: r.user?.email,
        state: r.state,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
      })),
      recentAdminAudits: recentAdminAudits.map((a) => ({
        id: a.id,
        action: a.action,
        targetId: a.targetId,
        createdAt: a.createdAt,
      })),
    };
  }

  async listAudits(limit = 50) {
    return this.adminAuditRepo.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  async listUsers() {
    const users = await this.usersRepo.find({ relations: ['profile'], order: { createdAt: 'DESC' } });
    return users.map((u) => this.mapUser(u));
  }

  async getUser(id: string) {
    const user = await this.usersRepo.findOne({ where: { id }, relations: ['profile'] });
    if (!user) return null;
    return this.mapUser(user, true);
  }

  async updateUserStatus(id: string, status: User['status']) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new Error('User not found');
    const previousStatus = user.status;

    user.status = status;
    await this.usersRepo.save(user);

    await this.refreshRepo.update({ user: { id } as any }, { revokedAt: new Date() });

    return this.getUser(id);
  }

  async updateUserRole(params: { id: string; role: UserProfile['role']; adminId?: string }) {
    const { id, role, adminId } = params;
    let profile = await this.profilesRepo.findOne({ where: { user: { id } as any }, relations: ['user'] });
    const previousRole = profile?.role ?? 'user';

    if (!profile) {
      profile = this.profilesRepo.create({ user: { id } as any, role });
    } else {
      profile.role = role;
    }
    await this.profilesRepo.save(profile);

    // Force re-login after role changes by revoking all refresh tokens for the user.
    await this.refreshRepo.update({ user: { id } as any }, { revokedAt: new Date() });

    if (adminId) {
      await this.adminAuditRepo.save(
        this.adminAuditRepo.create({
          admin: { id: adminId } as any,
          action: 'role_update',
          targetId: id,
          payload: { from: previousRole, to: role },
        }),
      );
    }

    return this.getUser(id);
  }

  /**
   * Admin: adjust a user's credit balance and record an admin audit.
   * Runs the balance change and audit in a single DB transaction.
   * Returns the new balance after the change.
   */
  async adjustUserCredit(id: string, dto: AdjustCreditDto, adminId?: string | null): Promise<number> {
    const { amount, direction, reason, note } = dto;
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id } });
      if (!user) throw new Error('User not found');
      const before = Number(user.creditBalance ?? 0);

      const after = await this.balanceService.applyChange(id, amount, direction, reason ?? 'admin-adjust', null, adminId ?? null, manager as any);

      const adminAuditRepo = manager.getRepository(AdminAudit);
      await adminAuditRepo.save(
        adminAuditRepo.create({
          admin: { id: adminId } as any,
          action: 'ADMIN_ADJUST_CREDIT',
          targetId: id,
          payload: { amount, direction, reason, note, before, after },
        }),
      );

      return after;
    });
  }

  async fetchUserCreditTransactions(id: string, limit = 10) {
    const rows = await this.txRepo.find({ where: { user: { id } as any }, order: { createdAt: 'DESC' }, take: limit });
    return rows.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      direction: r.direction,
      balanceAfter: Number(r.balanceAfter),
      reason: r.reason,
      reference: r.reference,
      createdAt: r.createdAt,
    }));
  }

  async getAccountsSummary() {
    const [totalUsers, activeUsers, pendingUsers, disabledUsers, rejectedUsers] = await Promise.all([
      this.usersRepo.count(),
      this.usersRepo.count({ where: { status: 'active' } }),
      this.usersRepo.count({ where: { status: 'pending' } }),
      this.usersRepo.count({ where: { status: 'disabled' } }),
      this.usersRepo.count({ where: { status: 'rejected' } }),
    ]);

    return { totalUsers, activeUsers, pendingUsers, disabledUsers, rejectedUsers };
  }

  async listAccounts(params: { status?: string; role?: string; search?: string; page: number; limit: number }) {
    const qb = this.usersRepo.createQueryBuilder('u').leftJoinAndSelect('u.profile', 'p');

    if (params.status) qb.andWhere('u.status = :status', { status: params.status });
    if (params.role) qb.andWhere('p.role = :role', { role: params.role });
    if (params.search) qb.andWhere('LOWER(u.email) LIKE :search', { search: `%${params.search.toLowerCase()}%` });

    qb.orderBy('u.createdAt', 'DESC').skip((params.page - 1) * params.limit).take(params.limit);

    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((u) => this.mapUser(u)),
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit) || 1,
      },
    };
  }

  async getAccountDetail(id: string) {
    const user = await this.usersRepo.findOne({ where: { id }, relations: ['profile'] });
    if (!user) return null;

    const [trustedDevicesCount, loginAudits, adminAudits] = await Promise.all([
      this.devicesRepo.count({ where: { user: { id } as any, revokedAt: IsNull() } }),
      this.loginAuditRepo.find({ where: { user: { id } as any }, order: { createdAt: 'DESC' }, take: 10 }),
      this.adminAuditRepo.find({ where: { targetId: id }, order: { createdAt: 'DESC' }, take: 10 }),
    ]);

    return {
      id: user.id,
      email: user.email,
      role: (user as any).profile?.role ?? 'user',
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      trustedDevicesCount,
      loginAudits,
      adminAudits,
    };
  }

  async updateAccountStatus(params: { id: string; status: User['status']; adminId?: string }) {
    const user = await this.usersRepo.findOne({ where: { id: params.id }, relations: ['profile'] });
    if (!user) throw new Error('User not found');

    const previous = user.status;
    user.status = params.status;
    await this.usersRepo.save(user);
    await this.refreshRepo.update({ user: { id: params.id } as any }, { revokedAt: new Date() });

    if (params.adminId) {
      await this.adminAuditRepo.save(
        this.adminAuditRepo.create({
          admin: { id: params.adminId } as any,
          action: 'account_status_update',
          targetId: params.id,
          payload: { from: previous, to: params.status },
        }),
      );
    }

    return this.getAccountDetail(params.id);
  }

  private mapUser(user: User, includeDetails = false) {
    return {
      id: user.id,
      email: user.email,
      // Unified credit system — expose single `creditBalance` only
      creditBalance: includeDetails ? Number(user.creditBalance ?? 0) : undefined,
      status: user.status,
      role: (user as any).profile?.role ?? 'user',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: includeDetails ? user.lastLoginAt : undefined,
    };
  }
}
