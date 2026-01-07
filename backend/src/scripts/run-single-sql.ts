import 'dotenv/config';
import { DataSource } from 'typeorm';

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const ssl = (process.env.DB_SSL || '').toLowerCase() === 'true';

  const ds = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
  } as any);

  try {
    await ds.initialize();
    console.log('Connected, executing SQL...');
    await ds.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false`);
    await ds.query(`CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders(archived)`);
    console.log('SQL applied successfully');
    await ds.destroy();
    process.exit(0);
  } catch (err) {
    console.error('SQL execution failed', err);
    try {
      await ds.destroy();
    } catch (_) {}
    process.exit(1);
  }
}

run();
