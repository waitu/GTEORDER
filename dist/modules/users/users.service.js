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
import { v4 as uuidv4 } from 'uuid';
import { User } from './user.entity.js';
import { UserProfile } from './user-profile.entity.js';
let UsersService = class UsersService {
    constructor(usersRepo, profilesRepo) {
        this.usersRepo = usersRepo;
        this.profilesRepo = profilesRepo;
    }
    async createPendingUser(params) {
        const user = this.usersRepo.create({
            id: uuidv4(),
            email: params.email.toLowerCase(),
            passwordHash: params.passwordHash,
            status: 'pending',
        });
        await this.usersRepo.save(user);
        const profile = this.profilesRepo.create({
            user,
            fullName: params.fullName,
            phone: params.phone,
            role: 'user',
        });
        await this.profilesRepo.save(profile);
        return user;
    }
    async findByEmail(email) {
        return this.usersRepo.findOne({ where: { email: email.toLowerCase() }, relations: ['profile'] });
    }
    async updateStatus(userId, status) {
        await this.usersRepo.update({ id: userId }, { status });
    }
};
UsersService = __decorate([
    Injectable(),
    __param(0, InjectRepository(User)),
    __param(1, InjectRepository(UserProfile)),
    __metadata("design:paramtypes", [Repository,
        Repository])
], UsersService);
export { UsersService };
//# sourceMappingURL=users.service.js.map