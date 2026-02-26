import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'admin_byeastside_sync_history' })
export class AdminByeastsideSyncHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'status', type: 'varchar', length: 16 })
  status!: 'success' | 'failed';

  @Column({ name: 'settings', type: 'jsonb' })
  settings!: Record<string, any>;

  @Column({ name: 'result', type: 'jsonb', nullable: true })
  result?: Record<string, any> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
