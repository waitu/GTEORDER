var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity.js';
let AdminAudit = class AdminAudit {
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    __metadata("design:type", String)
], AdminAudit.prototype, "id", void 0);
__decorate([
    ManyToOne(() => User, { onDelete: 'SET NULL' }),
    JoinColumn({ name: 'admin_id' }),
    __metadata("design:type", Object)
], AdminAudit.prototype, "admin", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], AdminAudit.prototype, "action", void 0);
__decorate([
    Column({ name: 'target_id', nullable: true }),
    __metadata("design:type", Object)
], AdminAudit.prototype, "targetId", void 0);
__decorate([
    Column({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], AdminAudit.prototype, "payload", void 0);
__decorate([
    CreateDateColumn({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], AdminAudit.prototype, "createdAt", void 0);
AdminAudit = __decorate([
    Entity({ name: 'admin_audit' })
], AdminAudit);
export { AdminAudit };
//# sourceMappingURL=admin-audit.entity.js.map