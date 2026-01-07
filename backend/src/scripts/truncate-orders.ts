import 'dotenv/config';
import { DataSource } from 'typeorm';
import readline from 'readline';

async function promptConfirm(): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('This will TRUNCATE TABLE orders CASCADE and permanently delete data. Type YES to proceed: ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'YES');
    });
  });
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Set it in your environment or .env file.');
    process.exit(1);
  }

  const ok = await promptConfirm();
  if (!ok) {
    console.log('Aborted by user');
    process.exit(0);
  }

  const ssl = (process.env.DB_SSL || '').toLowerCase() === 'true';

  const ds = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
  } as any);

  try {
    await ds.initialize();
    console.log('Connected to database. Running TRUNCATE TABLE orders CASCADE...');
    await ds.query('TRUNCATE TABLE orders CASCADE');
    console.log('Truncate complete.');
    await ds.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Failed to truncate orders:', err);
    try {
      await ds.destroy();
    } catch (_) {}
    process.exit(1);
  }
}

run();
