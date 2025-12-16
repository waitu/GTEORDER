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
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { AdminService } from '../admin/admin.service.js';
import { DeviceService } from '../devices/device.service.js';
import { OtpService } from '../otp/otp.service.js';
import { UsersService } from '../users/users.service.js';
import { RateLimitService } from '../../shared/rate-limit/rate-limit.service.js';
import { LoginAudit } from './login-audit.entity.js';
import { TokenService } from './token.service.js';
let AuthService = class AuthService {
    constructor(config, usersService, otpService, deviceService, adminService, tokenService, rateLimit, auditRepo) {
        this.config = config;
        this.usersService = usersService;
        this.otpService = otpService;
        this.deviceService = deviceService;
        this.adminService = adminService;
        this.tokenService = tokenService;
        this.rateLimit = rateLimit;
        this.auditRepo = auditRepo;
    }
    async register(params) {
        const passwordHash = await argon2.hash(params.password);
        const user = await this.usersService.createPendingUser({
            email: params.email,
            passwordHash,
            fullName: params.fullName,
            phone: params.phone,
        });
        await this.adminService.createRegistrationRequest(user.id);
        return user;
    }
    async validatePassword(email, password) {
        const user = await this.usersService.findByEmail(email);
        if (!user)
            return null;
        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok)
            return null;
        return user;
    }
    async recordLoginAudit(params) {
        await this.auditRepo.save(this.auditRepo.create({
            user: params.userId ? { id: params.userId } : undefined,
            ip: params.ip,
            userAgent: params.userAgent,
            deviceFingerprint: params.deviceFingerprint,
            result: params.result,
            reason: params.reason,
        }));
    }
    async login(params) {
        const ipKey = params.ip ?? 'unknown';
        await this.rateLimit.consume({ key: `login:ip:${ipKey}`, limit: 10, windowSeconds: 900 });
        await this.rateLimit.consume({ key: `login:user:${params.email.toLowerCase()}`, limit: 5, windowSeconds: 900 });
        const user = await this.validatePassword(params.email, params.password);
        if (!user) {
            await this.recordLoginAudit({ result: 'fail', reason: 'invalid_credentials', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: params.deviceFingerprint });
            throw new UnauthorizedException('Invalid credentials');
        }
        if (user.status !== 'active') {
            await this.recordLoginAudit({ userId: user.id, result: 'fail', reason: 'inactive', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: params.deviceFingerprint });
            throw new ForbiddenException('Account not active');
        }
        if (params.deviceToken) {
            const trusted = await this.deviceService.validateTrustedDevice({ deviceToken: params.deviceToken, fingerprint: params.deviceFingerprint });
            if (trusted && trusted.user?.id === user.id) {
                const accessToken = await this.tokenService.signAccessToken(user);
                const { token: refreshToken } = await this.tokenService.issueRefreshToken({ userId: user.id, deviceId: trusted.id });
                await this.recordLoginAudit({ userId: user.id, result: 'success', reason: 'trusted_device', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: params.deviceFingerprint });
                return { accessToken, refreshToken, trustedDevice: true };
            }
        }
        const { requestId, expiresAt, code } = await this.otpService.createOtp({
            userId: user.id,
            purpose: 'login',
            ttlSeconds: 300,
        });
        await this.otpService.sendLoginOtpEmail({ email: user.email, code, expiresAt });
        await this.recordLoginAudit({ userId: user.id, result: 'success', reason: 'otp_required', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: params.deviceFingerprint });
        return { needOtp: true, otpRequestId: requestId, expiresAt };
    }
    async verifyOtp(params) {
        await this.rateLimit.consume({ key: `otp_verify:req:${params.otpRequestId}`, limit: 6, windowSeconds: 600 });
        let otp;
        try {
            otp = await this.otpService.verifyOtp({ requestId: params.otpRequestId, code: params.code });
        }
        catch (err) {
            await this.recordLoginAudit({ result: 'fail', reason: 'otp_invalid', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: params.deviceFingerprint });
            throw new UnauthorizedException('Invalid or expired OTP');
        }
        const user = otp.user;
        if (user.status !== 'active') {
            await this.recordLoginAudit({ userId: user.id, result: 'fail', reason: 'inactive', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: params.deviceFingerprint });
            throw new ForbiddenException('Account not active');
        }
        let deviceId;
        let deviceToken;
        if (params.trustDevice) {
            const ttl = this.config.get('DEVICE_TOKEN_TTL') ?? 60 * 60 * 24 * 60;
            const expiresAt = new Date(Date.now() + ttl * 1000);
            const trusted = await this.deviceService.createTrustedDevice({
                userId: user.id,
                deviceFingerprint: params.deviceFingerprint,
                deviceName: params.deviceName,
                expiresAt,
            });
            deviceId = trusted.device.id;
            deviceToken = trusted.deviceToken;
        }
        const { token: refreshToken } = await this.tokenService.issueRefreshToken({ userId: user.id, deviceId });
        const accessToken = await this.tokenService.signAccessToken(user);
        await this.recordLoginAudit({ userId: user.id, result: 'success', reason: 'otp_success', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: params.deviceFingerprint });
        return { accessToken, refreshToken, deviceToken };
    }
    async refreshTokens(refreshToken) {
        const current = await this.tokenService.verifyRefreshToken(refreshToken);
        const user = current.user;
        if (user.status !== 'active') {
            await this.tokenService.revokeRefreshToken(current.id);
            throw new ForbiddenException('Account not active');
        }
        await this.tokenService.revokeRefreshToken(current.id);
        const { token: newRefresh } = await this.tokenService.issueRefreshToken({ userId: user.id, deviceId: current.device?.id });
        const accessToken = await this.tokenService.signAccessToken(user);
        await this.recordLoginAudit({
            userId: user.id,
            result: 'success',
            reason: 'refresh',
            deviceFingerprint: current.device?.deviceFingerprint ?? undefined,
        });
        return { accessToken, refreshToken: newRefresh };
    }
    async logout(refreshToken) {
        try {
            const current = await this.tokenService.verifyRefreshToken(refreshToken);
            await this.tokenService.revokeRefreshToken(current.id);
            await this.recordLoginAudit({
                userId: current.user.id,
                result: 'success',
                reason: 'logout',
                deviceFingerprint: current.device?.deviceFingerprint ?? undefined,
            });
        }
        catch (err) {
            throw new BadRequestException('Invalid refresh token');
        }
    }
};
AuthService = __decorate([
    Injectable(),
    __param(7, InjectRepository(LoginAudit)),
    __metadata("design:paramtypes", [ConfigService,
        UsersService,
        OtpService,
        DeviceService,
        AdminService,
        TokenService,
        RateLimitService,
        Repository])
], AuthService);
export { AuthService };
//# sourceMappingURL=auth.service.js.map