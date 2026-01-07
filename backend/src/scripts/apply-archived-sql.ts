import 'dotenv/config';
// @ts-ignore - pg has no included types in this workspace; runtime-only script
import { Client } from 'pg';

async function run() {
  const db = process.env.DATABASE_URL;
  if (!db) {
    console.error('Please set DATABASE_URL in environment');
    process.exit(1);
  }

  const client = new Client({ connectionString: db, ssl: (process.env.DB_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false as any });
  await client.connect();
  try {
    console.log('Applying archived column SQL...');
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders(archived)`);
    console.log('Applied archived column successfully');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Failed to apply SQL:', err);
    try {
      await client.end();
    } catch (_) {}
    process.exit(1);
  }
}

run();
