import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'pricing_rules' })
export class PricingRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  key!: string;

  @Column({ type: 'varchar', default: 'service' })
  kind!: 'service' | 'topup';

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  price?: string | null;

  @Column({ type: 'integer', nullable: true })
  credits?: number | null;

  @Column({ type: 'numeric', precision: 6, scale: 4, nullable: true })
  discount?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta?: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
