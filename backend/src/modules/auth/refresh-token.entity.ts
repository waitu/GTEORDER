import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { TrustedDevice } from '../devices/trusted-device.entity.js';
import { User } from '../users/user.entity.js';

@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => TrustedDevice, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'device_id' })
  device?: TrustedDevice | null;

  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'rotated_from', type: 'varchar', length: 255, nullable: true })
  rotatedFrom?: string | null;

  @Column({ name: 'rotated_to', type: 'varchar', length: 255, nullable: true })
  rotatedTo?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
