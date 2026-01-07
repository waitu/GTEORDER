import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { IsNull, Not, Repository } from 'typeorm';

import { RefreshToken } from './refresh-token.entity.js';
import { LoginAudit } from './login-audit.entity.js';
import { User } from '../users/user.entity.js';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken) private readonly refreshRepo: Repository<RefreshToken>,
    @InjectRepository(LoginAudit) private readonly auditRepo: Repository<LoginAudit>,
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

    // Link to the most recent revoked token for this device to enable reuse detection (token binding per device).
    let rotatedFrom: string | null = null;
    if (params.deviceId) {
      const latestRevoked = await this.refreshRepo.findOne({
        where: { device: { id: params.deviceId } as any, revokedAt: Not(IsNull()) },
        order: { revokedAt: 'DESC' },
      });
      rotatedFrom = latestRevoked?.id ?? null;
    }

    const entity = this.refreshRepo.create({
      user: { id: params.userId } as any,
      device: params.deviceId ? ({ id: params.deviceId } as any) : undefined,
      tokenHash: await argon2.hash(raw),
      expiresAt,
      rotatedFrom,
    });
    await this.refreshRepo.save(entity);

    if (rotatedFrom) {
      await this.refreshRepo.update({ id: rotatedFrom }, { rotatedTo: entity.id });
    }
    const token = `${entity.id}.${raw}`;
    return { token, entity };
  }

  async verifyRefreshToken(token: string): Promise<RefreshToken> {
    const [id, raw] = token.split('.');
    if (!id || !raw) throw new UnauthorizedException('Invalid refresh token');

    const entity = await this.refreshRepo.findOne({ where: { id }, relations: ['user', 'user.profile', 'device'] });
    if (!entity) throw new UnauthorizedException('Invalid refresh token');
    if (entity.revokedAt) {
      await this.handleReuse(entity, 'revoked');
    }
    if (entity.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Token expired');

    const ok = await argon2.verify(entity.tokenHash, raw);
    if (!ok) {
      await this.handleReuse(entity, 'invalid_hash');
    }

    // If the token was rotated (old token reused), treat as reuse attempt.
    if (entity.rotatedTo) {
      await this.handleReuse(entity, 'rotated_reuse');
    }

    return entity;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.refreshRepo.update({ id }, { revokedAt: new Date() });
  }

  async revokeAllForDevice(deviceId?: string | null, userId?: string) {
    const now = new Date();
    if (deviceId) {
      await this.refreshRepo.update({ device: { id: deviceId } as any }, { revokedAt: now });
    } else if (userId) {
      await this.refreshRepo.update({ user: { id: userId } as any }, { revokedAt: now });
    }
  }

  async revokeAllForUser(userId: string) {
    const now = new Date();
    await this.refreshRepo.update({ user: { id: userId } as any }, { revokedAt: now });
  }

  private async logSecurityEvent(entity: RefreshToken, reason: string) {
    // Security rationale: refresh token reuse suggests credential theft; audit for incident response.
    await this.auditRepo.save(
      this.auditRepo.create({
        user: entity.user ? ({ id: entity.user.id } as any) : undefined,
        result: 'fail',
        reason: `refresh_token_reuse:${reason}`,
      }),
    );
  }

  private async handleReuse(entity: RefreshToken, reason: string): Promise<never> {
    await this.revokeAllForDevice(entity.device?.id ?? null, entity.user?.id);
    await this.logSecurityEvent(entity, reason);
    throw new UnauthorizedException('Refresh token reuse detected');
  }
}
