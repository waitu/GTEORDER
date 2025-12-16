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
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { OtpCode } from './otp-code.entity.js';
import { MailerService } from '../../shared/mailer/mailer.service.js';
let OtpService = class OtpService {
    constructor(otpRepo, mailer) {
        this.otpRepo = otpRepo;
        this.mailer = mailer;
    }
    generateNumericCode(length = 6) {
        const min = 10 ** (length - 1);
        const max = 10 ** length - 1;
        return String(randomInt(min, max));
    }
    async createOtp(params) {
        const code = this.generateNumericCode(params.length ?? 6);
        const requestId = uuidv4();
        const expiresAt = new Date(Date.now() + params.ttlSeconds * 1000);
        const entity = this.otpRepo.create({
            user: { id: params.userId },
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
    async sendLoginOtpEmail(params) {
        const text = `Your login OTP is ${params.code}. It expires at ${params.expiresAt.toISOString()}. If you did not request, ignore this email.`;
        await this.mailer.send({ to: params.email, subject: 'Your login OTP', text });
    }
    async verifyOtp(params) {
        const otp = await this.otpRepo.findOne({ where: { requestId: params.requestId }, relations: ['user', 'user.profile'] });
        if (!otp)
            throw new Error('OTP not found');
        if (otp.usedAt)
            throw new Error('OTP already used');
        if (otp.expiresAt.getTime() < Date.now())
            throw new Error('OTP expired');
        if (otp.attempts >= otp.maxAttempts)
            throw new Error('OTP attempts exceeded');
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
};
OtpService = __decorate([
    Injectable(),
    __param(0, InjectRepository(OtpCode)),
    __metadata("design:paramtypes", [Repository,
        MailerService])
], OtpService);
export { OtpService };
//# sourceMappingURL=otp.service.js.map