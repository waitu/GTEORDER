import { ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { OtpCode, OtpPurpose } from './otp-code.entity.js';
import { MailerService } from '../../shared/mailer/mailer.service.js';
import { UsersService } from '../users/users.service.js';
import { RateLimitService } from '../../shared/rate-limit/rate-limit.service.js';
import { LoginAudit } from '../auth/login-audit.entity.js';

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OtpCode) private readonly otpRepo: Repository<OtpCode>,
    @InjectRepository(LoginAudit) private readonly auditRepo: Repository<LoginAudit>,
    private readonly mailer: MailerService,
    private readonly usersService: UsersService,
    private readonly rateLimit: RateLimitService,
    private readonly config: ConfigService,
  ) {}

  private otpSendLimits() {
    return {
      ipLimit: this.config.get<number>('OTP_SEND_LIMIT_IP') ?? 20,
      ipWindow: this.config.get<number>('OTP_SEND_WINDOW_IP') ?? 60 * 60, // 1 hour
      emailLimit: this.config.get<number>('OTP_SEND_LIMIT_EMAIL') ?? 5,
      emailWindow: this.config.get<number>('OTP_SEND_WINDOW_EMAIL') ?? 15 * 60, // 15 minutes
    };
  }

  generateNumericCode(length = 6): string {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return String(randomInt(min, max));
  }

  async createOtp(params: {
    userId: string;
    purpose: OtpPurpose;
    ttlSeconds: number;
    length?: number;
  }): Promise<{ requestId: string; code: string; expiresAt: Date }> {
    const code = this.generateNumericCode(params.length ?? 6);
    const requestId = uuidv4();
    const expiresAt = new Date(Date.now() + params.ttlSeconds * 1000);

    const entity = this.otpRepo.create({
      user: { id: params.userId } as any,
      codeHash: await argon2.hash(code),
      channel: 'email',
      purpose: params.purpose,
      expiresAt,
      attempts: 0,
      maxAttempts: 5,
      usedAt: null,
      sentAt: new Date(),
      requestId,
    });
    await this.otpRepo.save(entity);

    return { requestId, code, expiresAt };
  }

  async sendLoginOtpEmail(params: { email: string; code: string; expiresAt: Date; ip?: string; deviceInfo?: string }) {
    const expires = params.expiresAt.toLocaleString('en-US', { timeZone: 'UTC', timeStyle: 'short', dateStyle: 'medium' });

    const text = [
      'Your secure login code:',
      '',
      `OTP: ${params.code}`,
      `Expires: ${expires} UTC`,
      params.ip ? `Request IP: ${params.ip}` : undefined,
      params.deviceInfo ? `Device: ${params.deviceInfo}` : undefined,
      '',
      'If you did not request this code, secure your account immediately.',
    ]
      .filter(Boolean)
      .join('\n');

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
        <div style="max-width:520px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <div style="padding:20px 24px; background:linear-gradient(135deg,#0f172a,#1e293b); color:#e2e8f0;">
            <div style="font-size:12px; letter-spacing:1px; text-transform:uppercase; opacity:0.85;">Secure Sign-in</div>
            <div style="font-size:20px; font-weight:700; margin-top:6px;">Your One-Time Passcode</div>
          </div>
          <div style="padding:24px 24px 8px 24px;">
            <p style="margin:0 0 12px 0; font-size:15px; color:#0f172a;">Hi there,</p>
            <p style="margin:0 0 16px 0; font-size:14px; color:#334155;">Use the code below to finish signing in. This code works for one login only.</p>
            <div style="display:inline-flex; align-items:center; gap:12px; padding:14px 16px; background:#0ea5e9; color:#0b1120; font-weight:800; font-size:22px; letter-spacing:2px; border-radius:10px; box-shadow:0 6px 20px rgba(14,165,233,0.35);">${params.code}</div>
            <table style="margin-top:20px; width:100%; font-size:13px; color:#1f2937; border-collapse:collapse;">
              <tbody>
                <tr>
                  <td style="padding:6px 0; color:#475569;">Expires</td>
                  <td style="padding:6px 0; text-align:right; font-weight:600; color:#0f172a;">${expires} UTC</td>
                </tr>
                ${params.ip ? `<tr><td style="padding:6px 0; color:#475569;">Request IP</td><td style="padding:6px 0; text-align:right; color:#0f172a;">${params.ip}</td></tr>` : ''}
                ${params.deviceInfo ? `<tr><td style="padding:6px 0; color:#475569;">Device</td><td style="padding:6px 0; text-align:right; color:#0f172a;">${params.deviceInfo}</td></tr>` : ''}
              </tbody>
            </table>
            <div style="margin-top:18px; padding:12px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:10px; font-size:13px; color:#334155;">
              If you did not request this code, please ignore this email and update your account security.
            </div>
          </div>
          <div style="padding:14px 24px 18px 24px; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0;">This code is single-use. Never share it with anyone.</div>
        </div>
      </div>
    `;

    await this.mailer.send({ to: params.email, subject: 'Your login code', text, html });
  }

  private async logOtpSend(params: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    result: 'success' | 'fail';
    reason: string;
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

  async createAndSendLoginOtp(
    email: string,
    meta: { userId?: string; ip?: string; userAgent?: string; deviceFingerprint?: string; deviceInfo?: string },
  ): Promise<{ requestId: string; expiresAt: Date }> {
    const normalizedEmail = email.toLowerCase();
    const ipKey = meta.ip ?? 'unknown';
    const limits = this.otpSendLimits();

    try {
      await this.rateLimit.consume({ key: `otp_send:ip:${ipKey}`, limit: limits.ipLimit, windowSeconds: limits.ipWindow });
      await this.rateLimit.consume({ key: `otp_send:email:${normalizedEmail}`, limit: limits.emailLimit, windowSeconds: limits.emailWindow });
    } catch (err) {
      await this.logOtpSend({
        userId: meta.userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        deviceFingerprint: meta.deviceFingerprint,
        result: 'fail',
        reason: 'otp_send_rate_limited',
      });
      throw new HttpException({ message: 'Too many OTP requests. Please wait before retrying.' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      await this.logOtpSend({
        userId: meta.userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        deviceFingerprint: meta.deviceFingerprint,
        result: 'fail',
        reason: 'user_not_found',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      await this.logOtpSend({
        userId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
        deviceFingerprint: meta.deviceFingerprint,
        result: 'fail',
        reason: 'inactive',
      });
      throw new ForbiddenException('Account not active');
    }

    const { requestId, expiresAt, code } = await this.createOtp({
      userId: user.id,
      purpose: 'login',
      ttlSeconds: 300,
    });

    try {
      await this.sendLoginOtpEmail({ email: user.email, code, expiresAt, ip: meta.ip, deviceInfo: meta.deviceInfo ?? meta.userAgent });
    } catch (err) {
      // Surface mailer errors to logs for debugging
      // eslint-disable-next-line no-console
      console.error('OTP email send failed', err);
      await this.logOtpSend({
        userId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
        deviceFingerprint: meta.deviceFingerprint,
        result: 'fail',
        reason: 'email_send_failed',
      });
      throw new HttpException('Unable to send OTP right now. Please try again later.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    await this.logOtpSend({
      userId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      deviceFingerprint: meta.deviceFingerprint,
      result: 'success',
      reason: 'otp_sent',
    });

    return { requestId, expiresAt };
  }

  async findOtpWithUser(requestId: string): Promise<OtpCode | null> {
    return this.otpRepo.findOne({ where: { requestId }, relations: ['user', 'user.profile'] });
  }

  async verifyOtp(params: { requestId: string; code: string }): Promise<OtpCode> {
    const otp = await this.otpRepo.findOne({ where: { requestId: params.requestId }, relations: ['user', 'user.profile'] });

    if (!otp) {
      throw new Error('OTP not found');
    }

    if (otp.usedAt) {
      throw new Error('OTP already used');
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      throw new Error('OTP expired');
    }
    if (otp.attempts >= otp.maxAttempts) {
      throw new Error('OTP attempts exceeded');
    }

    let valid = false;
    try {
      valid = await argon2.verify(otp.codeHash.trim(), params.code.trim());
    } catch (err) {
      throw err;
    }
    otp.attempts += 1;

    if (!valid) {
      await this.otpRepo.save(otp);
      throw new Error('Invalid OTP');
    }

    otp.usedAt = new Date();
    await this.otpRepo.save(otp);
    return otp;
  }
}
