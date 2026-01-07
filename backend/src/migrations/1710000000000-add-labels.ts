import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLabels1710000000000 implements MigrationInterface {
  name = 'AddLabels1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'labels_import_type_enum') THEN CREATE TYPE "public"."labels_import_type_enum" AS ENUM('image','excel'); END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'labels_service_type_enum') THEN CREATE TYPE "public"."labels_service_type_enum" AS ENUM('scan','active','empty'); END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'labels_status_enum') THEN CREATE TYPE "public"."labels_status_enum" AS ENUM('pending','processing','completed','failed'); END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'labels') THEN
      CREATE TABLE "labels" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "import_type" "public"."labels_import_type_enum" NOT NULL,
        "service_type" "public"."labels_service_type_enum" NOT NULL,
        "label_file_url" character varying(2048) NOT NULL,
        "tracking_number" character varying(128),
        "carrier" character varying(64),
        "status" "public"."labels_status_enum" NOT NULL DEFAULT 'pending',
        "error_reason" text,
        "source_file_name" character varying(255),
        "client_request_id" character varying(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_labels_id" PRIMARY KEY ("id")
      );
    END IF; END$$;`);

    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'labels' AND indexname = 'idx_labels_user') THEN CREATE INDEX "idx_labels_user" ON "labels" ("user_id"); END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'labels' AND indexname = 'idx_labels_status') THEN CREATE INDEX "idx_labels_status" ON "labels" ("status"); END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'labels' AND indexname = 'idx_labels_service_type') THEN CREATE INDEX "idx_labels_service_type" ON "labels" ("service_type"); END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'labels' AND indexname = 'ux_labels_user_client_req') THEN CREATE UNIQUE INDEX "ux_labels_user_client_req" ON "labels" ("user_id", "client_request_id") WHERE client_request_id IS NOT NULL; END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_labels_user') THEN ALTER TABLE "labels" ADD CONSTRAINT "fk_labels_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END$$;`);

    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='label_id') THEN ALTER TABLE "orders" ADD COLUMN "label_id" uuid; END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_orders_label') THEN ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_label" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE SET NULL ON UPDATE NO ACTION; END IF; END$$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'orders' AND indexname = 'idx_orders_label_id') THEN CREATE INDEX "idx_orders_label_id" ON "orders" ("label_id"); END IF; END$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_label_id"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "fk_orders_label"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "label_id"`);

    await queryRunner.query(`ALTER TABLE "labels" DROP CONSTRAINT "fk_labels_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_labels_user_client_req"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_labels_service_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_labels_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_labels_user"`);
    await queryRunner.query(`DROP TABLE "labels"`);
    await queryRunner.query(`DROP TYPE "public"."labels_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."labels_service_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."labels_import_type_enum"`);
  }
}
