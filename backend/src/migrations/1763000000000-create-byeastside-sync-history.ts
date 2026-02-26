import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateByeastsideSyncHistory1763000000000 implements MigrationInterface {
  name = 'CreateByeastsideSyncHistory1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS admin_byeastside_sync_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      status varchar(16) NOT NULL,
      settings jsonb NOT NULL,
      result jsonb,
      error_message text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_byeastside_sync_history_created_at
      ON admin_byeastside_sync_history (created_at DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS admin_byeastside_sync_history');
  }
}
