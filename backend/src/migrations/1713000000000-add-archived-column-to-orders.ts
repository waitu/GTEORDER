import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArchivedColumnToOrders1713000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add archived column with default false for existing rows
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false`);
    // Create index on archived column for faster filtering
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders(archived)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_archived`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS archived`);
  }
}
