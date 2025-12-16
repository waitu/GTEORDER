var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { AdminModule } from './admin/admin.module.js';
import { DeviceModule } from './devices/device.module.js';
import { OtpModule } from './otp/otp.module.js';
import { envValidationSchema } from '../shared/config/env.validation.js';
import { typeOrmConfigFactory } from '../shared/config/typeorm.factory.js';
import { RedisModule } from '../shared/redis/redis.module.js';
import { RateLimitModule } from '../shared/rate-limit/rate-limit.module.js';
import { MailerModule } from '../shared/mailer/mailer.module.js';
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
        imports: [
            ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.local', '.env'],
                validationSchema: envValidationSchema,
            }),
            TypeOrmModule.forRootAsync({
                useFactory: typeOrmConfigFactory,
            }),
            RedisModule,
            RateLimitModule,
            MailerModule,
            UsersModule,
            AuthModule,
            OtpModule,
            DeviceModule,
            AdminModule,
        ],
    })
], AppModule);
export { AppModule };
//# sourceMappingURL=app.module.js.map