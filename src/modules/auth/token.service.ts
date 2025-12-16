import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';

import { RefreshToken } from './refresh-token.entity.js';
import { User } from '../users/user.entity.js';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken) private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  private accessTtl(): string {
    const seconds = this.config.get<number>('ACCESS_TOKEN_TTL') ?? 900;
    return `${seconds}s`;
  }

  private refreshTtlSeconds(): number {
    return this.config.get<number>('REFRESH_TOKEN_TTL') ?? 60 * 60 * 24 * 14;
  }

  signAccessToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: (user as any).profile?.role ?? 'user',
    };
    return this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.accessTtl(),
    });
  }

  async issueRefreshToken(params: { userId: string; deviceId?: string | null }): Promise<{ token: string; entity: RefreshToken }> {
    const raw = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.refreshTtlSeconds() * 1000);

    const entity = this.refreshRepo.create({
      user: { id: params.userId } as any,
      device: params.deviceId ? ({ id: params.deviceId } as any) : undefined,
      tokenHash: await argon2.hash(raw),
      expiresAt,
    });
    await this.refreshRepo.save(entity);
    const token = `${entity.id}.${raw}`;
    return { token, entity };
  }

  async verifyRefreshToken(token: string): Promise<RefreshToken> {
    const [id, raw] = token.split('.');
    if (!id || !raw) throw new UnauthorizedException('Invalid refresh token');

    const entity = await this.refreshRepo.findOne({ where: { id }, relations: ['user', 'user.profile', 'device'] });
    if (!entity) throw new UnauthorizedException('Invalid refresh token');
    if (entity.revokedAt) throw new UnauthorizedException('Token revoked');
    if (entity.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Token expired');

    const ok = await argon2.verify(entity.tokenHash, raw);
    if (!ok) throw new UnauthorizedException('Invalid refresh token');

    return entity;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.refreshRepo.update({ id }, { revokedAt: new Date() });
  }
}
