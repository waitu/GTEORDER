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
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { TrustedDevice } from './trusted-device.entity.js';
let DeviceService = class DeviceService {
    constructor(devicesRepo) {
        this.devicesRepo = devicesRepo;
    }
    async createTrustedDevice(params) {
        const rawToken = randomBytes(32).toString('hex');
        const device = this.devicesRepo.create({
            user: { id: params.userId },
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
    async validateTrustedDevice(params) {
        const [deviceId, rawToken] = params.deviceToken.split('.');
        if (!deviceId || !rawToken)
            return null;
        const device = await this.devicesRepo.findOne({ where: { id: deviceId }, relations: ['user'] });
        if (!device)
            return null;
        if (device.revokedAt)
            return null;
        if (device.expiresAt.getTime() < Date.now())
            return null;
        if (device.deviceFingerprint && params.fingerprint && device.deviceFingerprint !== params.fingerprint)
            return null;
        const valid = await argon2.verify(device.deviceTokenHash, rawToken);
        if (!valid)
            return null;
        device.lastUsedAt = new Date();
        await this.devicesRepo.save(device);
        return device;
    }
    async revokeDevice(deviceId) {
        await this.devicesRepo.update({ id: deviceId }, { revokedAt: new Date() });
    }
};
DeviceService = __decorate([
    Injectable(),
    __param(0, InjectRepository(TrustedDevice)),
    __metadata("design:paramtypes", [Repository])
], DeviceService);
export { DeviceService };
//# sourceMappingURL=device.service.js.map