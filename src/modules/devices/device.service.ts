import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';

import { TrustedDevice } from './trusted-device.entity.js';

@Injectable()
export class DeviceService {
  constructor(@InjectRepository(TrustedDevice) private readonly devicesRepo: Repository<TrustedDevice>) {}

  async createTrustedDevice(params: {
    userId: string;
    deviceFingerprint?: string;
    deviceName?: string;
    expiresAt: Date;
  }): Promise<{ deviceToken: string; device: TrustedDevice }> {
    const rawToken = randomBytes(32).toString('hex');
    const device = this.devicesRepo.create({
      user: { id: params.userId } as any,
      deviceTokenHash: await argon2.hash(rawToken),
      deviceFingerprint: params.deviceFingerprint,
      deviceName: params.deviceName,
      expiresAt: params.expiresAt,
      lastUsedAt: new Date(),
    });
    await this.devicesRepo.save(device);
    const deviceToken = `${device.id}.${rawToken}`;
    return { deviceToken, device };
  }

  async validateTrustedDevice(params: { deviceToken: string; fingerprint?: string }): Promise<TrustedDevice | null> {
    const [deviceId, rawToken] = params.deviceToken.split('.');
    if (!deviceId || !rawToken) return null;

    const device = await this.devicesRepo.findOne({ where: { id: deviceId }, relations: ['user'] });
    if (!device) return null;
    if (device.revokedAt) return null;
    if (device.expiresAt.getTime() < Date.now()) return null;
    if (device.deviceFingerprint && params.fingerprint && device.deviceFingerprint !== params.fingerprint) return null;
    const valid = await argon2.verify(device.deviceTokenHash, rawToken);
    if (!valid) return null;
    device.lastUsedAt = new Date();
    await this.devicesRepo.save(device);
    return device;
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this.devicesRepo.update({ id: deviceId }, { revokedAt: new Date() });
  }
}
