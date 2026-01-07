import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { User } from '../users/user.entity.js';

@Entity({ name: 'trusted_devices' })
export class TrustedDevice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'device_token_hash', type: 'varchar', length: 255 })
  deviceTokenHash!: string;

  @Column({ name: 'device_fingerprint', nullable: true, type: 'varchar', length: 255 })
  deviceFingerprint?: string | null;

  @Column({ name: 'device_name', nullable: true, type: 'varchar', length: 255 })
  deviceName?: string | null;

  @Column({ name: 'last_ip', nullable: true, type: 'varchar', length: 64 })
  lastIp?: string | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
