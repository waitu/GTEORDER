import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreditTopupsCreditAmountAndPackageKey1761000000000 implements MigrationInterface {
  name = 'AddCreditTopupsCreditAmountAndPackageKey1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE credit_topups ADD COLUMN IF NOT EXISTS credit_amount numeric(12,2)`);
    await queryRunner.query(`ALTER TABLE credit_topups ADD COLUMN IF NOT EXISTS package_key varchar`);

    // Backfill legacy rows where credit amount was implicitly the same as amount.
    await queryRunner.query(`UPDATE credit_topups SET credit_amount = amount WHERE credit_amount IS NULL`);

    await queryRunner.query(`ALTER TABLE credit_topups ALTER COLUMN credit_amount SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE credit_topups DROP COLUMN IF EXISTS package_key`);
    await queryRunner.query(`ALTER TABLE credit_topups DROP COLUMN IF EXISTS credit_amount`);
  }
}
