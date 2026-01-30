import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCreditTopups1760000000000 implements MigrationInterface {
  name = 'CreateCreditTopups1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS credit_topups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount numeric(12,2) NOT NULL,
      payment_method varchar NOT NULL,
      transfer_note varchar NOT NULL UNIQUE,
      note text,
      bill_image_url text NOT NULL,
      status varchar NOT NULL DEFAULT 'pending',
      admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
      admin_note text,
      created_at timestamptz DEFAULT now(),
      reviewed_at timestamptz
    )`);

    await queryRunner.query(`ALTER TABLE credit_topups
      ADD CONSTRAINT credit_topups_status_check CHECK (status IN ('pending','approved','rejected'))`);

    await queryRunner.query(`ALTER TABLE credit_topups
      ADD CONSTRAINT credit_topups_payment_method_check CHECK (payment_method IN ('pingpong_manual'))`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_credit_topups_status_created_at ON credit_topups (status, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_credit_topups_user_created_at ON credit_topups (user_id, created_at DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS credit_topups`);
  }
}
