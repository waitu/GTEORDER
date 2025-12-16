var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAudit } from './admin-audit.entity.js';
import { RegistrationRequest } from './registration-request.entity.js';
import { UsersService } from '../users/users.service.js';
let AdminService = class AdminService {
    constructor(registrationRepo, adminAuditRepo, usersService) {
        this.registrationRepo = registrationRepo;
        this.adminAuditRepo = adminAuditRepo;
        this.usersService = usersService;
    }
    async createRegistrationRequest(userId) {
        const request = this.registrationRepo.create({ user: { id: userId }, state: 'pending' });
        return this.registrationRepo.save(request);
    }
    async reviewRegistration(params) {
        const request = await this.registrationRepo.findOne({ where: { id: params.requestId }, relations: ['user'] });
        if (!request)
            throw new Error('Registration request not found');
        request.state = params.decision;
        request.reviewedBy = { id: params.adminId };
        request.reviewedAt = new Date();
        request.reason = params.reason;
        await this.registrationRepo.save(request);
        if (params.decision === 'approved') {
            await this.usersService.updateStatus(request.user.id, 'active');
        }
        else if (params.decision === 'rejected') {
            await this.usersService.updateStatus(request.user.id, 'rejected');
        }
        await this.adminAuditRepo.save(this.adminAuditRepo.create({
            admin: { id: params.adminId },
            action: 'registration_review',
            targetId: params.requestId,
            payload: { decision: params.decision, reason: params.reason },
        }));
    }
};
AdminService = __decorate([
    Injectable(),
    __param(0, InjectRepository(RegistrationRequest)),
    __param(1, InjectRepository(AdminAudit)),
    __metadata("design:paramtypes", [Repository,
        Repository,
        UsersService])
], AdminService);
export { AdminService };
//# sourceMappingURL=admin.service.js.map