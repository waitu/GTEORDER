import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectionToBalanceTransactions1715000000000 implements MigrationInterface {
  name = 'AddDirectionToBalanceTransactions1715000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Keep this migration portable: use varchar values without relying on a specific enum type.
    await queryRunner.query(`ALTER TABLE balance_transactions ADD COLUMN IF NOT EXISTS direction varchar(6)`);

    // Backfill direction based on sign of amount: negative -> 'debit', else 'credit'
    await queryRunner.query(
      `UPDATE balance_transactions
       SET direction = CASE WHEN amount < 0 THEN 'debit' ELSE 'credit' END
       WHERE direction IS NULL`,
    );

    // Ensure no nulls remain and set a default to 'credit'
    await queryRunner.query(`ALTER TABLE balance_transactions ALTER COLUMN direction SET DEFAULT 'credit'`);
    await queryRunner.query(`UPDATE balance_transactions SET direction = 'credit' WHERE direction IS NULL`);
    await queryRunner.query(`ALTER TABLE balance_transactions ALTER COLUMN direction SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE balance_transactions DROP COLUMN IF EXISTS direction`);
  }
}
