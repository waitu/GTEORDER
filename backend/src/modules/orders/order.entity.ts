import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, ValueTransformer } from 'typeorm';

import { User } from '../users/user.entity.js';
import { Label } from '../labels/label.entity.js';

const currencyTransformer: ValueTransformer = {
  to: (value?: number | null) => value ?? 0,
  from: (value: string | null) => (value != null ? Number(value) : null),
};

export enum OrderType {
  ACTIVE_TRACKING = 'active_tracking',
  EMPTY_PACKAGE = 'empty_package',
  DESIGN = 'design',
}

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
}

@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Label, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'label_id' })
  label?: Label | null;

  @Column({ name: 'order_type', type: 'enum', enum: OrderType })
  @Index()
  orderType!: OrderType;

  @Column({ name: 'tracking_code', type: 'varchar', length: 64, nullable: true })
  trackingCode?: string | null;

  @Column({ name: 'design_subtype', type: 'varchar', length: 128, nullable: true })
  designSubtype?: string | null;

  @Column({ name: 'label_url', type: 'varchar', length: 1024, nullable: true })
  labelUrl?: string | null;

  @Column({ name: 'label_image_url', type: 'varchar', length: 1024, nullable: true })
  labelImageUrl?: string | null;

  @Column({ name: 'result_url', type: 'varchar', length: 2048, nullable: true })
  resultUrl?: string | null;

  @Column({ name: 'asset_urls', type: 'text', array: true, nullable: true })
  assetUrls?: string[] | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  carrier?: string | null;

  @Column({ name: 'tracking_url', type: 'varchar', length: 1024, nullable: true })
  trackingUrl?: string | null;

  @Column({ name: 'tracking_activated_at', type: 'timestamptz', nullable: true })
  trackingActivatedAt?: Date | null;

  @Column({ name: 'first_checkpoint_at', type: 'timestamptz', nullable: true })
  firstCheckpointAt?: Date | null;

  @Column({ name: 'error_code', type: 'varchar', length: 128, nullable: true })
  errorCode?: string | null;

  @Column({ name: 'error_reason', type: 'text', nullable: true })
  errorReason?: string | null;

  @Column({ name: 'total_cost', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: currencyTransformer })
  totalCost!: number;

  @Column({ name: 'order_status', type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  @Index()
  orderStatus!: OrderStatus;

  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
  @Index()
  paymentStatus!: PaymentStatus;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote?: string | null;

  @Column({ name: 'archived', type: 'boolean', default: false })
  @Index()
  archived!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  @Index()
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
