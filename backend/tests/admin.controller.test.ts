import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

import { AdminController } from '../src/modules/admin/admin.controller.js';
import { ListRegistrationRequestsDto } from '../src/modules/admin/dto/list-registration-requests.dto.js';
import { ReviewRegistrationDto } from '../src/modules/admin/dto/review-registration.dto.js';

const makeReq = (user?: any) => ({ user });

describe('AdminController', () => {
  const adminService = {
    listRegistrationRequests: mock.fn(async (status: any) => [{ id: '1', state: status }]),
    reviewRegistration: mock.fn(async () => {}),
  } as any;
  const controller = new AdminController(adminService);

  it('lists registration requests with default pending', async () => {
    const query = new ListRegistrationRequestsDto();
    const res = await controller.listRequests(query);
    assert.deepEqual(res, [{ id: '1', state: 'pending' }]);
    assert.equal(adminService.listRegistrationRequests.mock.calls.length, 1);
    assert.equal(adminService.listRegistrationRequests.mock.calls[0].arguments[0], 'pending');
  });

  it('approves request with admin id from request', async () => {
    const body = new ReviewRegistrationDto();
    const req = makeReq({ sub: 'admin-1' });
    const result = await controller.approve('req-1', body, req as any);
    assert.equal(result.status, 'approved');
    const call = adminService.reviewRegistration.mock.calls.at(-1);
    assert.deepEqual(call?.arguments[0], {
      requestId: 'req-1',
      adminId: 'admin-1',
      decision: 'approved',
      reason: undefined,
    });
  });

  it('rejects request and propagates reason', async () => {
    const body = new ReviewRegistrationDto();
    body.reason = 'duplicate';
    const req = makeReq({ sub: 'admin-1' });
    const result = await controller.reject('req-2', body, req as any);
    assert.equal(result.status, 'rejected');
    const call = adminService.reviewRegistration.mock.calls.at(-1);
    assert.deepEqual(call?.arguments[0], {
      requestId: 'req-2',
      adminId: 'admin-1',
      decision: 'rejected',
      reason: 'duplicate',
    });
  });

  it('throws Unauthorized if admin id missing', async () => {
    const body = new ReviewRegistrationDto();
    await assert.rejects(() => controller.approve('req-3', body, makeReq(undefined) as any), UnauthorizedException);
  });

  it('maps not-found error to 404', async () => {
    adminService.reviewRegistration.mock.mockImplementationOnce(async () => {
      const err: any = new Error('Registration request not found');
      throw err;
    });
    const body = new ReviewRegistrationDto();
    const req = makeReq({ sub: 'admin-1' });
    await assert.rejects(() => controller.reject('req-404', body, req as any), NotFoundException);
  });
});
