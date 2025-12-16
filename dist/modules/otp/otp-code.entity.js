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
let OtpCode = class OtpCode {
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    __metadata("design:type", String)
], OtpCode.prototype, "id", void 0);
__decorate([
    ManyToOne(() => User, { onDelete: 'CASCADE' }),
    JoinColumn({ name: 'user_id' }),
    __metadata("design:type", User)
], OtpCode.prototype, "user", void 0);
__decorate([
    Column({ name: 'code_hash' }),
    __metadata("design:type", String)
], OtpCode.prototype, "codeHash", void 0);
__decorate([
    Column({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], OtpCode.prototype, "channel", void 0);
__decorate([
    Column({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], OtpCode.prototype, "purpose", void 0);
__decorate([
    Column({ name: 'expires_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], OtpCode.prototype, "expiresAt", void 0);
__decorate([
    Column({ default: 0 }),
    __metadata("design:type", Number)
], OtpCode.prototype, "attempts", void 0);
__decorate([
    Column({ name: 'max_attempts', default: 5 }),
    __metadata("design:type", Number)
], OtpCode.prototype, "maxAttempts", void 0);
__decorate([
    Column({ name: 'used_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], OtpCode.prototype, "usedAt", void 0);
__decorate([
    Column({ name: 'sent_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], OtpCode.prototype, "sentAt", void 0);
__decorate([
    Column({ name: 'request_id' }),
    __metadata("design:type", String)
], OtpCode.prototype, "requestId", void 0);
__decorate([
    CreateDateColumn({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], OtpCode.prototype, "createdAt", void 0);
OtpCode = __decorate([
    Entity({ name: 'otp_codes' })
], OtpCode);
export { OtpCode };
//# sourceMappingURL=otp-code.entity.js.map