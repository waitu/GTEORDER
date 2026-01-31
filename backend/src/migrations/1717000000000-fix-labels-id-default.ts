import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixLabelsIdDefault1717000000000 implements MigrationInterface {
  name = 'FixLabelsIdDefault1717000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure UUID generation is available (used by DEFAULT below).
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Existing deployments created labels.id WITHOUT a default, which breaks inserts that use DEFAULT.
    await queryRunner.query('ALTER TABLE "labels" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "labels" ALTER COLUMN "id" DROP DEFAULT');
  }
}
