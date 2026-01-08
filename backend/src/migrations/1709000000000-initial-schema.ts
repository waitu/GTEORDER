import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1709000000000 implements MigrationInterface {
  name = 'InitialSchema1709000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Core tables required by existing incremental migrations.

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    // USERS + PROFILES
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL UNIQUE,
        "password_hash" varchar(255),
        "balance" numeric(12,2) NOT NULL DEFAULT 0,
        "credit_balance" numeric(12,2) NOT NULL DEFAULT 0,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "failed_login_count" int NOT NULL DEFAULT 0,
        "lock_until" timestamptz,
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL UNIQUE,
        "full_name" varchar(255),
        "phone" varchar(64),
        "role" varchar(16) NOT NULL DEFAULT 'user',
        "metadata" jsonb,
        CONSTRAINT "fk_user_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    // OTP + AUTH
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "otp_codes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "code_hash" varchar(255) NOT NULL,
        "channel" varchar(32) NOT NULL,
        "purpose" varchar(32) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "attempts" int NOT NULL DEFAULT 0,
        "max_attempts" int NOT NULL DEFAULT 5,
        "used_at" timestamptz,
        "sent_at" timestamptz NOT NULL,
        "request_id" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_otp_codes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trusted_devices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "device_token_hash" varchar(255) NOT NULL,
        "device_fingerprint" varchar(255),
        "device_name" varchar(255),
        "last_ip" varchar(64),
        "last_used_at" timestamptz,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_trusted_devices_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "device_id" uuid,
        "token_hash" varchar(255) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "rotated_from" varchar(255),
        "rotated_to" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_refresh_tokens_device" FOREIGN KEY ("device_id") REFERENCES "trusted_devices"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "login_audit" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "ip" varchar(64),
        "user_agent" varchar(255),
        "device_fingerprint" varchar(255),
        "result" varchar(16) NOT NULL,
        "reason" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_login_audit_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);

    // ADMIN
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "registration_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "state" varchar(16) NOT NULL DEFAULT 'pending',
        "reviewed_by" uuid,
        "reviewed_at" timestamptz,
        "reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_registration_requests_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_registration_requests_reviewer" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "admin_id" uuid,
        "action" varchar(255) NOT NULL,
        "target_id" varchar(255),
        "payload" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_admin_audit_admin" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);

    // ORDERS (needed by later migrations and balance_transactions FK)
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_order_type_enum') THEN
          CREATE TYPE "public"."order_order_type_enum" AS ENUM ('active_tracking','empty_package','design');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_order_status_enum') THEN
          CREATE TYPE "public"."order_order_status_enum" AS ENUM ('pending','processing','completed','failed');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_payment_status_enum') THEN
          CREATE TYPE "public"."order_payment_status_enum" AS ENUM ('unpaid','paid');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "label_id" uuid,
        "order_type" "public"."order_order_type_enum" NOT NULL,
        "tracking_code" varchar(64),
        "design_subtype" varchar(128),
        "label_url" varchar(1024),
        "label_image_url" varchar(1024),
        "result_url" varchar(2048),
        "asset_urls" text[],
        "carrier" varchar(64),
        "tracking_url" varchar(1024),
        "tracking_activated_at" timestamptz,
        "first_checkpoint_at" timestamptz,
        "error_code" varchar(128),
        "error_reason" text,
        "total_cost" numeric(12,2) NOT NULL DEFAULT 0,
        "order_status" "public"."order_order_status_enum" NOT NULL DEFAULT 'pending',
        "payment_status" "public"."order_payment_status_enum" NOT NULL DEFAULT 'unpaid',
        "admin_note" text,
        "archived" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_orders_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_order_type" ON "orders" ("order_type");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_order_status" ON "orders" ("order_status");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_payment_status" ON "orders" ("payment_status");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_archived" ON "orders" ("archived");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_created_at" ON "orders" ("created_at");`);

    // BALANCE TRANSACTIONS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "balance_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "order_id" uuid,
        "amount" numeric(12,2) NOT NULL,
        "direction" varchar(6) NOT NULL DEFAULT 'credit',
        "balance_after" numeric(12,2) NOT NULL,
        "reason" varchar(255),
        "reference" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_balance_tx_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_balance_tx_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Keep down minimal; production deployments typically don't roll back initial schema.
    await queryRunner.query(`DROP TABLE IF EXISTS "balance_transactions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "registration_requests";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "login_audit";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trusted_devices";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "otp_codes";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_profiles";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."order_payment_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."order_order_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."order_order_type_enum";`);
  }
}
