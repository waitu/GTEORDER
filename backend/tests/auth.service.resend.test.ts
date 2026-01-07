import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { HttpException, HttpStatus } from '@nestjs/common';

import { AuthService } from '../src/modules/auth/auth.service.js';

class StubConfigService {
  get() {
    return undefined;
  }
}

describe('AuthService.resendOtp', () => {
  const config = new StubConfigService() as any;
  const usersService = {} as any;
  const deviceService = {} as any;
  const adminService = {} as any;
  const tokenService = {} as any;

  const auditRepo = {
    create: (data: any) => data,
    save: mock.fn(async () => undefined),
  } as any;

  it('sends new OTP when under limits and user active', async () => {
    const otpService = {
      findOtpWithUser: mock.fn(async () => ({ user: { id: 'u1', email: 'u@example.com', status: 'active' } })),
      createOtp: mock.fn(async () => ({ requestId: 'new-req', code: '123456', expiresAt: new Date(0) })),
      sendLoginOtpEmail: mock.fn(async () => undefined),
    } as any;
    const rateLimit = {
      consume: mock.fn(async () => undefined),
    } as any;

    const service = new AuthService(
      config,
      usersService,
      otpService,
      deviceService,
      adminService,
      tokenService,
      rateLimit,
      auditRepo,
    );

    const res = await service.resendOtp({ otpRequestId: 'req', ip: '1.1.1.1', userAgent: 'UA', deviceInfo: 'Laptop' });
    assert.equal(res.needOtp, true);
    assert.equal(res.otpRequestId, 'new-req');
    assert.equal(rateLimit.consume.mock.calls.length, 2);
    assert.equal(otpService.sendLoginOtpEmail.mock.calls.length, 1);
    const emailArgs = otpService.sendLoginOtpEmail.mock.calls[0].arguments[0];
    assert.equal(emailArgs.ip, '1.1.1.1');
    assert.equal(emailArgs.deviceInfo, 'Laptop');
    assert.equal(auditRepo.save.mock.calls.at(-1)?.arguments[0].reason, 'otp_resend');
  });

  it('throws cooldown when user limit exceeded and logs failure', async () => {
    const otpService = {
      findOtpWithUser: mock.fn(async () => ({ user: { id: 'u1', email: 'u@example.com', status: 'active' } })),
      createOtp: mock.fn(),
      sendLoginOtpEmail: mock.fn(),
    } as any;
    const rateLimit = {
      consume: mock.fn(async () => {
        throw new Error('rate limited');
      }),
    } as any;

    const service = new AuthService(
      config,
      usersService,
      otpService,
      deviceService,
      adminService,
      tokenService,
      rateLimit,
      auditRepo,
    );

    await assert.rejects(async () => {
      await service.resendOtp({ otpRequestId: 'req', ip: '1.1.1.1', userAgent: 'UA' });
    }, (err: any) => err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS);
    assert.equal(auditRepo.save.mock.calls.at(-1)?.arguments[0].reason, 'otp_resend_rate_limited_user');
  });
});
