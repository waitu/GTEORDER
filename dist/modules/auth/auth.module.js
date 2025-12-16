var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module.js';
import { DeviceModule } from '../devices/device.module.js';
import { OtpModule } from '../otp/otp.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginAudit } from './login-audit.entity.js';
import { RefreshToken } from './refresh-token.entity.js';
import { TokenService } from './token.service.js';
let AuthModule = class AuthModule {
};
AuthModule = __decorate([
    Module({
        imports: [
            TypeOrmModule.forFeature([RefreshToken, LoginAudit]),
            UsersModule,
            OtpModule,
            DeviceModule,
            AdminModule,
            JwtModule.register({}),
        ],
        controllers: [AuthController],
        providers: [AuthService, TokenService],
        exports: [AuthService, TokenService],
    })
], AuthModule);
export { AuthModule };
//# sourceMappingURL=auth.module.js.map