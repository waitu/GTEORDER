import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { User } from '../users/user.entity.js';

@Entity({ name: 'login_audit' })
export class LoginAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ nullable: true, type: 'varchar', length: 64 })
  ip?: string | null;

  @Column({ name: 'user_agent', nullable: true, type: 'varchar', length: 255 })
  userAgent?: string | null;

  @Column({ name: 'device_fingerprint', nullable: true, type: 'varchar', length: 255 })
  deviceFingerprint?: string | null;

  @Column({ type: 'varchar', length: 16 })
  result!: 'success' | 'fail';

  @Column({ nullable: true, type: 'varchar', length: 255 })
  reason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
