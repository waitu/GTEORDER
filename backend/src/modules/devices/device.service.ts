import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import * as argon2 from 'argon2';

import { TrustedDevice } from './trusted-device.entity.js';

@Injectable()
export class DeviceService {
  constructor(@InjectRepository(TrustedDevice) private readonly devicesRepo: Repository<TrustedDevice>) {}

  computeFingerprint(raw: { userAgent?: string; platform?: string; timezone?: string }): string | null {
    if (!raw.userAgent || !raw.platform || !raw.timezone) return null;
    return `${raw.userAgent}|${raw.platform}|${raw.timezone}`;
  }

  hashFingerprint(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async createTrustedDevice(params: {
    userId: string;
    deviceFingerprintRaw: string;
    deviceName?: string;
    expiresAt: Date;
  }): Promise<{ deviceToken: string; device: TrustedDevice }> {
    if (!params.deviceFingerprintRaw) {
      throw new UnauthorizedException('Device fingerprint required');
    }
    const rawToken = randomBytes(32).toString('hex');
    const fingerprintHash = this.hashFingerprint(params.deviceFingerprintRaw);
    const device = this.devicesRepo.create({
      user: { id: params.userId } as any,
      deviceTokenHash: await argon2.hash(rawToken),
      deviceFingerprint: fingerprintHash,
      deviceName: params.deviceName,
      expiresAt: params.expiresAt,
      lastUsedAt: new Date(),
    });
    await this.devicesRepo.save(device);
    const deviceToken = `${device.id}.${rawToken}`;
    return { deviceToken, device };
  }

  async validateTrustedDevice(params: { deviceToken: string; fingerprintRaw: string }): Promise<TrustedDevice | null> {
    const [deviceId, rawToken] = params.deviceToken.split('.');
    if (!deviceId || !rawToken || !params.fingerprintRaw) return null;

    const device = await this.devicesRepo.findOne({ where: { id: deviceId }, relations: ['user'] });
    if (!device) return null;
    if (device.revokedAt) return null;
    if (device.expiresAt.getTime() < Date.now()) return null;
    const fingerprintHash = this.hashFingerprint(params.fingerprintRaw);
    if (device.deviceFingerprint && fingerprintHash !== device.deviceFingerprint) return null;
    const valid = await argon2.verify(device.deviceTokenHash, rawToken);
    if (!valid) return null;
    device.lastUsedAt = new Date();
    await this.devicesRepo.save(device);
    return device;
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this.devicesRepo.update({ id: deviceId }, { revokedAt: new Date() });
  }

  async listDevicesForUser(userId: string): Promise<TrustedDevice[]> {
    return this.devicesRepo.find({ where: { user: { id: userId } as any, revokedAt: IsNull() } });
  }

  async revokeDeviceForUser(userId: string, deviceId: string): Promise<void> {
    const device = await this.devicesRepo.findOne({ where: { id: deviceId }, relations: ['user'] });
    if (!device || device.user.id !== userId) throw new UnauthorizedException('Device not found');
    await this.revokeDevice(deviceId);
  }
}
