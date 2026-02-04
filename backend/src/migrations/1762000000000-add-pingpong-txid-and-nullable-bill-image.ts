import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPingpongTxidAndNullableBillImage1762000000000 implements MigrationInterface {
  name = 'AddPingpongTxidAndNullableBillImage1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Allow new flow without bill images
    await queryRunner.query(`ALTER TABLE credit_topups ALTER COLUMN bill_image_url DROP NOT NULL`);

    // Add PingPong transaction id (nullable for legacy rows)
    await queryRunner.query(`ALTER TABLE credit_topups ADD COLUMN IF NOT EXISTS pingpong_tx_id varchar`);

    // Prevent duplicate submissions when tx id is present
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_topups_pingpong_tx_id ON credit_topups (pingpong_tx_id) WHERE pingpong_tx_id IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_credit_topups_pingpong_tx_id`);
    await queryRunner.query(`ALTER TABLE credit_topups DROP COLUMN IF EXISTS pingpong_tx_id`);
    await queryRunner.query(`ALTER TABLE credit_topups ALTER COLUMN bill_image_url SET NOT NULL`);
  }
}
