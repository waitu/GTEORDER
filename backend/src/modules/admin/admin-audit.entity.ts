import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { User } from '../users/user.entity.js';

@Entity({ name: 'admin_audit' })
export class AdminAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'admin_id' })
  admin?: User | null;

  @Column({ type: 'varchar', length: 255 })
  action!: string;

  @Column({ name: 'target_id', type: 'varchar', length: 255, nullable: true })
  targetId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
