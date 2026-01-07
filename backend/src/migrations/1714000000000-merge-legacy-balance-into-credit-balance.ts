import { MigrationInterface, QueryRunner } from 'typeorm';

// Migration: merge legacy `balance` values into `credit_balance`.
// Strategy (safe, auditable):
// 1) Ensure `credit_balance` column exists (IF NOT EXISTS).
// 2) For all users, add any legacy `balance` value into `credit_balance`.
// 3) Leave legacy `balance` column in place for verification; do not drop here.

export class MergeLegacyBalanceIntoCreditBalance1714000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure column exists (matching entity definition: numeric(12,2) default 0)
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance numeric(12,2) DEFAULT 0`);

    // Populate credit_balance by adding any existing legacy balance values.
    // Use COALESCE to avoid null issues and only touch rows where a non-zero legacy
    // balance is present to minimize WAL churn.
    await queryRunner.query(`
      UPDATE users
      SET credit_balance = COALESCE(credit_balance, 0) + COALESCE(balance, 0)
      WHERE COALESCE(balance, 0) <> 0
    `);

    // Create audit BalanceTransaction rows for migrated balances so there's an
    // explicit ledger entry for the migration. We rely on the `balance_transactions`
    // table shape: (id uuid, user_id, order_id, amount, balance_after, reason, reference, created_at).
    // Ensure `pgcrypto` extension is available to generate UUIDs in SQL.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      INSERT INTO balance_transactions (id, user_id, order_id, amount, balance_after, reason, reference, created_at)
      SELECT
        gen_random_uuid(),
        u.id,
        NULL,
        -- the migrated credit amount is treated as a credit (positive)
        COALESCE(u.balance, 0)::numeric(12,2) AS amount,
        -- balance_after should reflect the new credit_balance value after addition
        (COALESCE(u.credit_balance, 0) + COALESCE(u.balance, 0))::numeric(12,2) AS balance_after,
        'legacy_balance_migration'::varchar,
        'legacy_balance_migration'::varchar,
        NOW()
      FROM users u
      WHERE COALESCE(u.balance, 0) <> 0
    `);

    // Optional: ensure credit_balance is non-null and has a default for future inserts
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN credit_balance SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN credit_balance SET DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Attempt a safe revert: subtract legacy `balance` back out of `credit_balance` for rows
    // where we know the migration previously added it. This is best-effort and assumes
    // that `balance` has not been otherwise mutated since the migration ran.
    await queryRunner.query(`
      UPDATE users
      SET credit_balance = COALESCE(credit_balance, 0) - COALESCE(balance, 0)
      WHERE COALESCE(balance, 0) <> 0
    `);

    // We leave the `credit_balance` column in place to avoid data loss in case it pre-existed.
    // If you prefer to drop the column when rolling back, uncomment the following line:
    // await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS credit_balance`);
  }
}
