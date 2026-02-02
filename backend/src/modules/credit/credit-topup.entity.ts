import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../users/user.entity.js';

export enum CreditTopupStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum CreditTopupPaymentMethod {
  PINGPONG_MANUAL = 'pingpong_manual',
}

@Entity({ name: 'credit_topups' })
@Index(['user', 'createdAt'])
@Index(['status', 'createdAt'])
export class CreditTopup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: number;

  // Credits that will be granted on approval. For legacy/manual topups, this equals `amount`.
  @Column({ name: 'credit_amount', type: 'numeric', precision: 12, scale: 2 })
  creditAmount!: number;

  // Optional key of the pricing package used to compute (paid amount -> credit amount).
  @Column({ name: 'package_key', type: 'varchar', nullable: true })
  packageKey?: string | null;

  @Column({ name: 'payment_method', type: 'varchar' })
  paymentMethod!: CreditTopupPaymentMethod;

  @Column({ name: 'transfer_note', type: 'varchar', unique: true })
  transferNote!: string;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string | null;

  // Stored as internal path (not publicly accessible). Use API to view.
  @Column({ name: 'bill_image_url', type: 'text' })
  billImageUrl!: string;

  @Column({ type: 'varchar', default: CreditTopupStatus.PENDING })
  status!: CreditTopupStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'admin_id' })
  admin?: User | null;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;
}
