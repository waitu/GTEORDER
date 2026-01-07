import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { User } from '../users/user.entity.js';

export enum LabelImportType {
  IMAGE = 'image',
  EXCEL = 'excel',
}

export enum LabelServiceType {
  SCAN = 'scan',
  ACTIVE = 'active',
  EMPTY = 'empty',
}

export enum LabelStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity({ name: 'labels' })
@Index('idx_labels_user', ['user'])
@Index('idx_labels_status', ['status'])
@Index('idx_labels_service_type', ['serviceType'])
@Index('ux_labels_user_client_req', ['user', 'clientRequestId'], {
  unique: true,
  where: '"client_request_id" IS NOT NULL',
})
export class Label {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'import_type', type: 'enum', enum: LabelImportType })
  importType!: LabelImportType;

  @Column({ name: 'service_type', type: 'enum', enum: LabelServiceType })
  serviceType!: LabelServiceType;

  @Column({ name: 'label_file_url', type: 'varchar', length: 2048 })
  labelFileUrl!: string;

  @Column({ name: 'tracking_number', type: 'varchar', length: 128, nullable: true })
  trackingNumber?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  carrier?: string | null;

  @Column({ type: 'enum', enum: LabelStatus, default: LabelStatus.PENDING })
  status!: LabelStatus;

  @Column({ name: 'error_reason', type: 'text', nullable: true })
  errorReason?: string | null;

  @Column({ name: 'source_file_name', type: 'varchar', length: 255, nullable: true })
  sourceFileName?: string | null;

  @Column({ name: 'client_request_id', type: 'varchar', length: 255, nullable: true })
  clientRequestId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
