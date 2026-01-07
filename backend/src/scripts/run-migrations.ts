import 'dotenv/config';
import { DataSource } from 'typeorm';

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set in environment');
    process.exit(1);
  }

  const ssl = (process.env.DB_SSL || '').toLowerCase() === 'true';

  const ds = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    migrations: ['dist/migrations/*.js'],
  } as any);

  try {
    await ds.initialize();
    console.log('DataSource initialized, running migrations...');
    const res = await ds.runMigrations();
    console.log('Migrations complete:', res.map((r) => r.name));
    await ds.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Migration run failed', err);
    try {
      await ds.destroy();
    } catch (_) {}
    process.exit(1);
  }
}

run();
