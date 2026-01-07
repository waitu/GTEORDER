import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { User, UserStatus } from './user.entity.js';
import { UserProfile } from './user-profile.entity.js';
import { RefreshToken } from '../auth/refresh-token.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(UserProfile) private readonly profilesRepo: Repository<UserProfile>,
    @InjectRepository(RefreshToken) private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  async createPendingUser(params: {
    email: string;
    fullName?: string;
    phone?: string;
  }): Promise<User> {
    const email = params.email.toLowerCase();
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) {
      // If the user already exists, keep the existing record (id used downstream) and do not insert a duplicate.
      return existing;
    }

    const user = this.usersRepo.create({
      id: uuidv4(),
      email,
      passwordHash: null,
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

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email: email.toLowerCase() }, relations: ['profile'] });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id }, relations: ['profile'] });
  }

  async recordFailedLogin(user: User): Promise<{ failedLoginCount: number; lockUntil: Date | null; lockApplied?: 'short' | 'long' }> {
    const now = Date.now();
    let failed = (user.failedLoginCount ?? 0) + 1;
    let lockUntil = user.lockUntil ?? null;
    let lockApplied: 'short' | 'long' | undefined;

    // Apply escalating lockouts per user regardless of IP to mitigate credential stuffing.
    if (failed >= 10) {
      lockUntil = new Date(now + 24 * 60 * 60 * 1000);
      lockApplied = 'long';
    } else if (failed >= 5) {
      lockUntil = new Date(now + 15 * 60 * 1000);
      lockApplied = 'short';
    }

    await this.usersRepo.update({ id: user.id }, { failedLoginCount: failed, lockUntil });
    return { failedLoginCount: failed, lockUntil, lockApplied };
  }

  async recordLoginSuccess(userId: string): Promise<void> {
    await this.usersRepo.update({ id: userId }, { failedLoginCount: 0, lockUntil: null, lastLoginAt: new Date() });
  }

  async updateStatus(userId: string, status: UserStatus): Promise<void> {
    await this.usersRepo.update({ id: userId }, { status });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.refreshRepo.update({ user: { id: userId } as any }, { revokedAt: new Date() });
  }
}
