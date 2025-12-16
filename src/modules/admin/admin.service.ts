import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AdminAudit } from './admin-audit.entity.js';
import { RegistrationRequest, RegistrationState } from './registration-request.entity.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(RegistrationRequest)
    private readonly registrationRepo: Repository<RegistrationRequest>,
    @InjectRepository(AdminAudit)
    private readonly adminAuditRepo: Repository<AdminAudit>,
    private readonly usersService: UsersService,
  ) {}

  async createRegistrationRequest(userId: string): Promise<RegistrationRequest> {
    const request = this.registrationRepo.create({ user: { id: userId } as any, state: 'pending' });
    return this.registrationRepo.save(request);
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
}
