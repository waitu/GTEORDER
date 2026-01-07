import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, ValueTransformer } from 'typeorm';

import { User } from '../../modules/users/user.entity.js';
import { Order } from '../../modules/orders/order.entity.js';

const currencyTransformer: ValueTransformer = {
  to: (value?: number | null) => value ?? 0,
  from: (value: string | null) => (value != null ? Number(value) : null),
};
@Entity({ name: 'balance_transactions' })
export class BalanceTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order?: Order | null;

  // Signed amount: positive for credits, negative for debits
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: currencyTransformer })
  amount!: number;

  // Direction enum for easier querying: 'credit' or 'debit'
  @Column({ type: 'varchar', length: 6 })
  direction!: 'credit' | 'debit';

  @Column({ name: 'balance_after', type: 'numeric', precision: 12, scale: 2, transformer: currencyTransformer })
  balanceAfter!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
