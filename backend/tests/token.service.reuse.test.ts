import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { TokenService } from '../src/modules/auth/token.service.js';

const stubConfig = { get: () => undefined } as any;
const stubJwt = {} as any;

const makeRefreshRepo = () => {
  return {
    create: (data: any) => ({ ...data }),
    save: mock.fn(async (data: any) => ({ ...data, id: data.id ?? 'new-id' })),
    update: mock.fn(async () => undefined),
    findOne: mock.fn(),
  } as any;
};

const makeAuditRepo = () => ({
  create: (data: any) => data,
  save: mock.fn(async () => undefined),
}) as any;

describe('TokenService refresh reuse handling', () => {
  it('links rotated tokens when issuing new for same device', async () => {
    const refreshRepo = makeRefreshRepo();
    const auditRepo = makeAuditRepo();
    refreshRepo.findOne.mock.mockImplementation(async () => ({ id: 'old-token', revokedAt: new Date(), device: { id: 'dev1' } }));

    const service = new TokenService(stubJwt, stubConfig, refreshRepo, auditRepo);
    const { entity } = await service.issueRefreshToken({ userId: 'u1', deviceId: 'dev1' });

    assert.equal(entity.rotatedFrom, 'old-token');
    assert.equal(refreshRepo.update.mock.calls.length, 1);
    assert.deepEqual(refreshRepo.update.mock.calls[0].arguments[0], { id: 'old-token' });
  });

  it('revokes all device tokens and logs on reuse of revoked token', async () => {
    const refreshRepo = makeRefreshRepo();
    const auditRepo = makeAuditRepo();
    const reused = {
      id: 'reuse-id',
      tokenHash: 'hash',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      user: { id: 'u1' },
      device: { id: 'dev1' },
    } as any;
    refreshRepo.findOne.mock.mockImplementation(async () => reused);

    const service = new TokenService(stubJwt, stubConfig, refreshRepo, auditRepo);

    await assert.rejects(() => service.verifyRefreshToken('reuse-id.raw'), (err: any) => err?.message === 'Refresh token reuse detected');
    // revokeAllForDevice should have updated by device filter
    assert.equal(refreshRepo.update.mock.calls.length > 0, true);
    assert.equal(auditRepo.save.mock.calls.length > 0, true);
  });
});
