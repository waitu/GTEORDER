var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity.js';
let UserProfile = class UserProfile {
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    __metadata("design:type", String)
], UserProfile.prototype, "id", void 0);
__decorate([
    OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' }),
    JoinColumn({ name: 'user_id' }),
    __metadata("design:type", User)
], UserProfile.prototype, "user", void 0);
__decorate([
    Column({ name: 'full_name', nullable: true }),
    __metadata("design:type", Object)
], UserProfile.prototype, "fullName", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", Object)
], UserProfile.prototype, "phone", void 0);
__decorate([
    Column({ type: 'varchar', length: 16, default: 'user' }),
    __metadata("design:type", String)
], UserProfile.prototype, "role", void 0);
__decorate([
    Column({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], UserProfile.prototype, "metadata", void 0);
UserProfile = __decorate([
    Entity({ name: 'user_profiles' })
], UserProfile);
export { UserProfile };
//# sourceMappingURL=user-profile.entity.js.map