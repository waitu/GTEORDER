import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { OtpCode, OtpPurpose } from './otp-code.entity.js';
import { MailerService } from '../../shared/mailer/mailer.service.js';

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OtpCode) private readonly otpRepo: Repository<OtpCode>,
    private readonly mailer: MailerService,
  ) {}

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

  async sendLoginOtpEmail(params: { email: string; code: string; expiresAt: Date }) {
    const text = `Your login OTP is ${params.code}. It expires at ${params.expiresAt.toISOString()}. If you did not request, ignore this email.`;
    await this.mailer.send({ to: params.email, subject: 'Your login OTP', text });
  }

  async verifyOtp(params: { requestId: string; code: string }): Promise<OtpCode> {
    const otp = await this.otpRepo.findOne({ where: { requestId: params.requestId }, relations: ['user', 'user.profile'] });
    if (!otp) throw new Error('OTP not found');
    if (otp.usedAt) throw new Error('OTP already used');
    if (otp.expiresAt.getTime() < Date.now()) throw new Error('OTP expired');
    if (otp.attempts >= otp.maxAttempts) throw new Error('OTP attempts exceeded');

    const valid = await argon2.verify(otp.codeHash, params.code);
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
