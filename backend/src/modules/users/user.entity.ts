import { Column, CreateDateColumn, Entity, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { UserProfile } from './user-profile.entity.js';

export type UserStatus = 'pending' | 'active' | 'disabled' | 'rejected';

const currencyTransformer = {
  to: (value?: number | null) => value ?? 0,
  from: (value: string | null) => (value != null ? Number(value) : null),
};

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash?: string | null;

  @Column({ name: 'balance', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: currencyTransformer })
  // DEPRECATED: legacy `balance` field retained temporarily for migration/audit.
  // DO NOT USE this field in business logic. Use `creditBalance` instead.
  // Unified credit system – single balance
  balance!: number;

  // Unified credit system – single balance
  @Column({ name: 'credit_balance', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: currencyTransformer })
  creditBalance!: number;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: UserStatus;

  @Column({ name: 'failed_login_count', type: 'int', default: 0 })
  failedLoginCount!: number;

  @Column({ name: 'lock_until', type: 'timestamptz', nullable: true })
  lockUntil?: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  @OneToOne('UserProfile', (profile: UserProfile) => profile.user)
  profile?: UserProfile;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
