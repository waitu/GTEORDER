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
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { RefreshToken } from './refresh-token.entity.js';
let TokenService = class TokenService {
    constructor(jwtService, config, refreshRepo) {
        this.jwtService = jwtService;
        this.config = config;
        this.refreshRepo = refreshRepo;
    }
    accessTtl() {
        const seconds = this.config.get('ACCESS_TOKEN_TTL') ?? 900;
        return `${seconds}s`;
    }
    refreshTtlSeconds() {
        return this.config.get('REFRESH_TOKEN_TTL') ?? 60 * 60 * 24 * 14;
    }
    signAccessToken(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.profile?.role,
        };
        return this.jwtService.signAsync(payload, {
            secret: this.config.get('JWT_ACCESS_SECRET'),
            expiresIn: this.accessTtl(),
        });
    }
    async issueRefreshToken(params) {
        const raw = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + this.refreshTtlSeconds() * 1000);
        const entity = this.refreshRepo.create({
            user: { id: params.userId },
            device: params.deviceId ? { id: params.deviceId } : undefined,
            tokenHash: await argon2.hash(raw),
            expiresAt,
        });
        await this.refreshRepo.save(entity);
        const token = `${entity.id}.${raw}`;
        return { token, entity };
    }
    async verifyRefreshToken(token) {
        const [id, raw] = token.split('.');
        if (!id || !raw)
            throw new UnauthorizedException('Invalid refresh token');
        const entity = await this.refreshRepo.findOne({ where: { id }, relations: ['user', 'user.profile', 'device'] });
        if (!entity)
            throw new UnauthorizedException('Invalid refresh token');
        if (entity.revokedAt)
            throw new UnauthorizedException('Token revoked');
        if (entity.expiresAt.getTime() < Date.now())
            throw new UnauthorizedException('Token expired');
        const ok = await argon2.verify(entity.tokenHash, raw);
        if (!ok)
            throw new UnauthorizedException('Invalid refresh token');
        return entity;
    }
    async revokeRefreshToken(id) {
        await this.refreshRepo.update({ id }, { revokedAt: new Date() });
    }
};
TokenService = __decorate([
    Injectable(),
    __param(2, InjectRepository(RefreshToken)),
    __metadata("design:paramtypes", [JwtService,
        ConfigService,
        Repository])
], TokenService);
export { TokenService };
//# sourceMappingURL=token.service.js.map