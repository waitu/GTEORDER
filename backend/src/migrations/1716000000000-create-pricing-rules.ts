import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePricingRules1716000000000 implements MigrationInterface {
  name = 'CreatePricingRules1716000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS pricing_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key varchar NOT NULL UNIQUE,
      kind varchar NOT NULL,
      price numeric(12,4),
      credits integer,
      discount numeric(6,4),
      meta jsonb,
      created_at timestamptz DEFAULT now()
    )`);

    // Seed service credit costs
    await queryRunner.query(`INSERT INTO pricing_rules (key, kind, price) VALUES
      ('scan_label', 'service', 0.35),
      ('empty_package', 'service', 1),
      ('design_2d', 'service', 1),
      ('design_3d', 'service', 2),
      ('embroidery_text', 'service', 1.25),
      ('embroidery_image', 'service', 1.75),
      ('sidebow', 'service', 1.5),
      ('poster_canvas', 'service', 1.5)
    ON CONFLICT (key) DO NOTHING;`);

    // Seed top-up packages
    await queryRunner.query(`INSERT INTO pricing_rules (key, kind, price, credits, discount) VALUES
      ('basic', 'topup', 1.5, 1, 0),
      ('standard', 'topup', 14.5, 10, 0.03),
      ('premier', 'topup', 70, 50, 0.07),
      ('ultra', 'topup', 135, 100, 0.10)
    ON CONFLICT (key) DO NOTHING;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS pricing_rules`);
  }
}
