import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AdminService } from '../admin/admin.service.js';
import { DeviceService } from '../devices/device.service.js';
import { OtpService } from '../otp/otp.service.js';
import { UsersService } from '../users/users.service.js';
import { RateLimitService } from '../../shared/rate-limit/rate-limit.service.js';
import { LoginAudit } from './login-audit.entity.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly deviceService: DeviceService,
    private readonly adminService: AdminService,
    private readonly tokenService: TokenService,
    private readonly rateLimit: RateLimitService,
    @InjectRepository(LoginAudit) private readonly auditRepo: Repository<LoginAudit>,
  ) {}

  async register(params: { email: string; fullName?: string; phone?: string }) {
    const user = await this.usersService.createPendingUser({
      email: params.email,
      fullName: params.fullName,
      phone: params.phone,
    });
    await this.adminService.createRegistrationRequest(user.id);
    return user;
  }

  async recordLoginAudit(params: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    result: 'success' | 'fail';
    reason?: string;
  }) {
    await this.auditRepo.save(
      this.auditRepo.create({
        user: params.userId ? ({ id: params.userId } as any) : undefined,
        ip: params.ip,
        userAgent: params.userAgent,
        deviceFingerprint: params.deviceFingerprint,
        result: params.result,
        reason: params.reason,
      }),
    );
  }

  async login(params: {
    email: string;
    deviceFingerprint?: string;
    deviceToken?: string;
    platform?: string;
    timezone?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const fingerprintRaw = this.deviceService.computeFingerprint({
      userAgent: params.userAgent,
      platform: params.platform,
      timezone: params.timezone,
    });
    const fingerprintHash = fingerprintRaw ? this.deviceService.hashFingerprint(fingerprintRaw) : undefined;

    const ipKey = params.ip ?? 'unknown';
    await this.rateLimit.consume({ key: `login:ip:${ipKey}`, limit: 10, windowSeconds: 900 });
    await this.rateLimit.consume({ key: `login:user:${params.email.toLowerCase()}`, limit: 5, windowSeconds: 900 });
    const user = await this.usersService.findByEmail(params.email);
    if (!user) {
      await this.recordLoginAudit({ result: 'fail', reason: 'user_not_found', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: fingerprintHash });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      await this.recordLoginAudit({ userId: user.id, result: 'fail', reason: 'status_invalid', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: fingerprintHash });
      throw new ForbiddenException('Account not active');
    }

    if (params.deviceToken && fingerprintRaw) {
      const trusted = await this.deviceService.validateTrustedDevice({ deviceToken: params.deviceToken, fingerprintRaw });
      if (trusted && trusted.user?.id === user.id) {
        await this.usersService.recordLoginSuccess(user.id);
        const accessToken = await this.tokenService.signAccessToken(user);
        const { token: refreshToken } = await this.tokenService.issueRefreshToken({ userId: user.id, deviceId: trusted.id });
        await this.recordLoginAudit({ userId: user.id, result: 'success', reason: 'trusted_device', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: fingerprintHash });
        return { accessToken, refreshToken, trustedDevice: true };
      }
      if (!trusted) {
        await this.recordLoginAudit({ userId: user.id, result: 'fail', reason: 'trusted_device_fingerprint_mismatch', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: fingerprintHash });
      }
    }

    const { requestId, expiresAt } = await this.otpService.createAndSendLoginOtp(user.email, {
      userId: user.id,
      ip: params.ip,
      userAgent: params.userAgent,
      deviceFingerprint: fingerprintHash,
      deviceInfo: params.userAgent,
    });
    await this.recordLoginAudit({ userId: user.id, result: 'success', reason: 'otp_required', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: fingerprintHash });
    return { needOtp: true, otpRequestId: requestId, expiresAt };
  }

  async resendOtp(params: { otpRequestId: string; ip?: string; userAgent?: string; deviceInfo?: string; platform?: string; timezone?: string }) {
    let otp;
    try {
      otp = await this.otpService.findOtpWithUser(params.otpRequestId);
    } catch (err) {
      otp = null;
    }

    if (!otp || !otp.user) {
      await this.recordLoginAudit({ result: 'fail', reason: 'otp_resend_invalid_request', ip: params.ip, userAgent: params.userAgent });
      throw new UnauthorizedException('Invalid OTP request');
    }

    const user = otp.user;
    if (user.status !== 'active') {
      await this.recordLoginAudit({ userId: user.id, result: 'fail', reason: 'status_invalid', ip: params.ip, userAgent: params.userAgent });
      throw new ForbiddenException('Account not active');
    }

    const { requestId, expiresAt } = await this.otpService.createAndSendLoginOtp(user.email, {
      userId: user.id,
      ip: params.ip,
      userAgent: params.userAgent,
      deviceFingerprint: undefined,
      deviceInfo: params.deviceInfo ?? params.userAgent,
    });

    await this.recordLoginAudit({ userId: user.id, result: 'success', reason: 'otp_resend', ip: params.ip, userAgent: params.userAgent });
    return { needOtp: true, otpRequestId: requestId, expiresAt };
  }

  async verifyOtp(params: {
    otpRequestId: string;
    code: string;
    trustDevice?: boolean;
    deviceName?: string;
    deviceFingerprint?: string;
    platform?: string;
    timezone?: string;
    ip?: string;
    userAgent?: string;
  }) {
    await this.rateLimit.consume({ key: `otp_verify:req:${params.otpRequestId}`, limit: 6, windowSeconds: 600 });

    const fingerprintRaw = this.deviceService.computeFingerprint({
      userAgent: params.userAgent,
      platform: params.platform,
      timezone: params.timezone,
    });
    const fingerprintHash = fingerprintRaw ? this.deviceService.hashFingerprint(fingerprintRaw) : undefined;

    let otp;
    try {
      otp = await this.otpService.verifyOtp({ requestId: params.otpRequestId, code: params.code });
    } catch (err: any) {
      const msg = err?.message ?? 'Invalid or expired OTP';
      await this.recordLoginAudit({ result: 'fail', reason: 'otp_invalid', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: fingerprintHash });
      // Surface the specific reason during debugging
      throw new UnauthorizedException(msg);
    }

    const user = otp.user;
    if (user.status !== 'active') {
      await this.recordLoginAudit({ userId: user.id, result: 'fail', reason: 'status_invalid', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: fingerprintHash });
      throw new ForbiddenException('Account not active');
    }

    let deviceId: string | undefined;
    let deviceToken: string | undefined;
    if (params.trustDevice) {
      const fingerprintRaw = this.deviceService.computeFingerprint({
        userAgent: params.userAgent,
        platform: params.platform,
        timezone: params.timezone,
      });
      if (!fingerprintRaw) {
        throw new BadRequestException('Device fingerprint required to trust device');
      }
      const ttl = this.config.get<number>('DEVICE_TOKEN_TTL') ?? 60 * 60 * 24 * 60;
      const expiresAt = new Date(Date.now() + ttl * 1000);
      const trusted = await this.deviceService.createTrustedDevice({
        userId: user.id,
        deviceFingerprintRaw: fingerprintRaw,
        deviceName: params.deviceName,
        expiresAt,
      });
      deviceId = trusted.device.id;
      deviceToken = trusted.deviceToken;
    }

    await this.usersService.recordLoginSuccess(user.id);

    const { token: refreshToken } = await this.tokenService.issueRefreshToken({ userId: user.id, deviceId });
    const accessToken = await this.tokenService.signAccessToken(user);
    await this.recordLoginAudit({ userId: user.id, result: 'success', reason: 'otp_success', ip: params.ip, userAgent: params.userAgent, deviceFingerprint: fingerprintHash });
    return { accessToken, refreshToken, deviceToken };
  }

  async refreshTokens(refreshToken: string) {
    const current = await this.tokenService.verifyRefreshToken(refreshToken);
    const user = current.user;
    if (user.status !== 'active') {
      await this.tokenService.revokeAllForDevice(current.device?.id ?? null, user.id);
      await this.recordLoginAudit({
        userId: user.id,
        result: 'fail',
        reason: 'status_invalid',
        deviceFingerprint: current.device?.deviceFingerprint ?? undefined,
      });
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

  async logout(refreshToken: string) {
    try {
      const current = await this.tokenService.verifyRefreshToken(refreshToken);
      await this.tokenService.revokeRefreshToken(current.id);
      await this.recordLoginAudit({
        userId: current.user.id,
        result: 'success',
        reason: 'logout',
        deviceFingerprint: current.device?.deviceFingerprint ?? undefined,
      });
    } catch (err) {
      throw new BadRequestException('Invalid refresh token');
    }
  }
}
