import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AdminAuthGuard } from '../src/modules/admin/admin-auth.guard.js';

class StubConfigService {
  constructor(private readonly secret: string) {}
  get(key: string) {
    if (key === 'JWT_ACCESS_SECRET') return this.secret;
    return undefined;
  }
}

const makeContext = (authHeader?: string) => {
  const req: any = { headers: {} };
  if (authHeader) req.headers['authorization'] = authHeader;
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
};

describe('AdminAuthGuard', () => {
  const secret = 'test-secret-12345678901234567890123456789012';
  const jwt = new JwtService({});
  const config = new StubConfigService(secret) as any;
  const guard = new AdminAuthGuard(jwt, config);

  it('allows admin token and attaches user payload', async () => {
    const token = await jwt.signAsync({ sub: 'admin-id', email: 'a@example.com', role: 'admin' }, { secret });
    const ctx = makeContext(`Bearer ${token}`);
    const result = await guard.canActivate(ctx);
    assert.equal(result, true);
    const req = ctx.switchToHttp().getRequest();
    assert.equal(req.user.sub, 'admin-id');
  });

  it('rejects missing header', async () => {
    await assert.rejects(() => guard.canActivate(makeContext()), UnauthorizedException);
  });

  it('rejects non-admin role', async () => {
    const token = await jwt.signAsync({ sub: 'u', email: 'u@example.com', role: 'user' }, { secret });
    const ctx = makeContext(`Bearer ${token}`);
    await assert.rejects(() => guard.canActivate(ctx), ForbiddenException);
  });

  it('rejects invalid token', async () => {
    const ctx = makeContext('Bearer invalid');
    await assert.rejects(() => guard.canActivate(ctx), UnauthorizedException);
  });
});
