import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLabelsAndOrderLabelId1712000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid generation function available
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create enum types (idempotent)
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'label_import_type') THEN CREATE TYPE label_import_type AS ENUM ('image', 'excel'); END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'label_service_type') THEN CREATE TYPE label_service_type AS ENUM ('scan', 'active', 'empty'); END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'label_status') THEN CREATE TYPE label_status AS ENUM ('pending','processing','completed','failed'); END IF; END$$;`);

    // Create labels table (idempotent)
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'labels') THEN
      CREATE TABLE labels (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        import_type label_import_type NOT NULL,
        service_type label_service_type NOT NULL,
        label_file_url varchar(2048) NOT NULL,
        tracking_number varchar(128),
        carrier varchar(64),
        status label_status NOT NULL DEFAULT 'pending',
        error_reason text,
        source_file_name varchar(255),
        client_request_id varchar(255),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_labels_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    END IF; END$$;`);

    // Indexes (idempotent)
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'labels' AND indexname = 'idx_labels_user') THEN CREATE INDEX idx_labels_user ON labels(user_id); END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'labels' AND indexname = 'idx_labels_status') THEN CREATE INDEX idx_labels_status ON labels(status); END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'labels' AND indexname = 'idx_labels_service_type') THEN CREATE INDEX idx_labels_service_type ON labels(service_type); END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'labels' AND indexname = 'ux_labels_user_client_req') THEN CREATE UNIQUE INDEX ux_labels_user_client_req ON labels(user_id, client_request_id) WHERE client_request_id IS NOT NULL; END IF; END$$;`);

    // Add label_id to orders if not exists
    const hasColumn = await queryRunner.hasColumn('orders', 'label_id');
    if (!hasColumn) {
      await queryRunner.query(`ALTER TABLE orders ADD COLUMN label_id uuid NULL`);
      await queryRunner.query(`ALTER TABLE orders ADD CONSTRAINT fk_orders_label FOREIGN KEY(label_id) REFERENCES labels(id) ON DELETE SET NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop FK from orders and column
    const hasColumn = await queryRunner.hasColumn('orders', 'label_id');
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_label`);
      await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS label_id`);
    }

    // Drop labels table and types
    await queryRunner.query(`DROP INDEX IF EXISTS ux_labels_user_client_req`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_labels_service_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_labels_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_labels_user`);
    await queryRunner.query(`DROP TABLE IF EXISTS labels`);

    await queryRunner.query(`DROP TYPE IF EXISTS label_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS label_service_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS label_import_type`);
  }
}
