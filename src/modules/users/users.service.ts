import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { User, UserStatus } from './user.entity.js';
import { UserProfile } from './user-profile.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(UserProfile) private readonly profilesRepo: Repository<UserProfile>,
  ) {}

  async createPendingUser(params: {
    email: string;
    passwordHash: string;
    fullName?: string;
    phone?: string;
  }): Promise<User> {
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

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  async updateStatus(userId: string, status: UserStatus): Promise<void> {
    await this.usersRepo.update({ id: userId }, { status });
  }
}
