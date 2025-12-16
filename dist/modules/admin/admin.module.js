var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAudit } from './admin-audit.entity.js';
import { RegistrationRequest } from './registration-request.entity.js';
import { AdminService } from './admin.service.js';
import { UsersModule } from '../users/users.module.js';
let AdminModule = class AdminModule {
};
AdminModule = __decorate([
    Module({
        imports: [TypeOrmModule.forFeature([RegistrationRequest, AdminAudit]), UsersModule],
        providers: [AdminService],
        exports: [AdminService],
    })
], AdminModule);
export { AdminModule };
//# sourceMappingURL=admin.module.js.map