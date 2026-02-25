import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppSettings1717000000000 implements MigrationInterface {
  name = 'CreateAppSettings1717000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS app_settings (
      key varchar PRIMARY KEY,
      value jsonb NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS app_settings');
  }
}
