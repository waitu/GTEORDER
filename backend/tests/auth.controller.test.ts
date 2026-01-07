import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { AuthController } from '../src/modules/auth/auth.controller.js';
import { LoginDto } from '../src/modules/auth/dto/login.dto.js';
import { RegisterDto } from '../src/modules/auth/dto/register.dto.js';
import { OtpVerifyDto } from '../src/modules/auth/dto/otp-verify.dto.js';
import { OtpResendDto } from '../src/modules/auth/dto/otp-resend.dto.js';
import { RefreshDto } from '../src/modules/auth/dto/refresh.dto.js';

describe('AuthController', () => {
  const service = {
    register: mock.fn(async () => undefined),
    login: mock.fn(async () => ({ needOtp: true })),
    verifyOtp: mock.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
    resendOtp: mock.fn(async () => ({ needOtp: true, otpRequestId: 'new', expiresAt: new Date(0) })),
    refreshTokens: mock.fn(async () => ({ accessToken: 'a2', refreshToken: 'r2' })),
    logout: mock.fn(async () => undefined),
  } as any;
  const controller = new AuthController(service);

  it('register returns pending status', async () => {
    const dto = new RegisterDto();
    dto.email = 'u@example.com';
    dto.password = 'Password123!';
    const res = await controller.register(dto);
    assert.deepEqual(res, { status: 'pending' });
    assert.equal(service.register.mock.calls.length, 1);
    assert.equal(service.register.mock.calls[0].arguments[0].email, 'u@example.com');
  });

  it('login forwards ip and user-agent', async () => {
    const dto = new LoginDto();
    dto.email = 'u@example.com';
    dto.password = 'Password123!';
    const req: any = { ip: '1.1.1.1', headers: { 'user-agent': 'UA' } };
    const res = await controller.login(dto, req);
    assert.equal(res.needOtp, true);
    const call = service.login.mock.calls.at(-1);
    assert.deepEqual(call?.arguments[0], {
      email: 'u@example.com',
      password: 'Password123!',
      deviceFingerprint: undefined,
      deviceToken: undefined,
      platform: undefined,
      timezone: undefined,
      ip: '1.1.1.1',
      userAgent: 'UA',
    });
  });

  it('resendOtp forwards ip and user-agent', async () => {
    const dto = new OtpResendDto();
    dto.otpRequestId = 'req';
    const req: any = { ip: '3.3.3.3', headers: { 'user-agent': 'UA3' } };
    const res = await controller.resendOtp(dto, req);
    assert.equal(res.needOtp, true);
    const call = service.resendOtp.mock.calls.at(-1);
    assert.deepEqual(call?.arguments[0], {
      otpRequestId: 'req',
      deviceInfo: undefined,
      platform: undefined,
      timezone: undefined,
      ip: '3.3.3.3',
      userAgent: 'UA3',
    });
  });

  it('verifyOtp forwards request metadata', async () => {
    const dto = new OtpVerifyDto();
    dto.otpRequestId = 'req';
    dto.code = '123456';
    const req: any = { ip: '2.2.2.2', headers: { 'user-agent': 'UA2' } };
    const res = await controller.verifyOtp(dto, req);
    assert.equal(res.accessToken, 'a');
    const call = service.verifyOtp.mock.calls.at(-1);
    assert.deepEqual(call?.arguments[0], {
      otpRequestId: 'req',
      code: '123456',
      trustDevice: undefined,
      deviceName: undefined,
      deviceFingerprint: undefined,
      platform: undefined,
      timezone: undefined,
      ip: '2.2.2.2',
      userAgent: 'UA2',
    });
  });

  it('refresh returns new tokens', async () => {
    const dto = new RefreshDto();
    dto.refreshToken = 'rt';
    const res = await controller.refresh(dto);
    assert.deepEqual(res, { accessToken: 'a2', refreshToken: 'r2' });
    assert.equal(service.refreshTokens.mock.calls.length, 1);
  });

  it('logout returns empty object', async () => {
    const dto = new RefreshDto();
    dto.refreshToken = 'rt';
    const res = await controller.logout(dto);
    assert.deepEqual(res, {});
    assert.equal(service.logout.mock.calls.length, 1);
  });
});
