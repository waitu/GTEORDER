import cron from 'node-cron';

import dataSource from '../shared/config/typeorm.datasource.js';
import { AppSetting } from '../shared/config/app-setting.entity.js';
import { runByeastsideSync } from '../shared/integrations/byeastside-sync.js';

const TZ = 'Asia/Ho_Chi_Minh';
const DEFAULT_CRON = '0 21 * * *';
const SETTINGS_KEY = 'byeastside_sync';

type ByeastsideSettings = {
  cron: string;
  enabled: boolean;
  limit: number;
  pageSize: number;
  page: number;
};

const getEnv = (key: string, required = true): string => {
  const value = process.env[key];
  if (!value && required) {
    throw new Error(`Missing env: ${key}`);
  }
  return value ?? '';
};

const getEnvNumber = (key: string, fallback: number): number => {
  const raw = process.env[key];
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
};

const normalizeSettings = (input: Partial<ByeastsideSettings>): ByeastsideSettings => {
  const rawCron = (input.cron ?? process.env.BYEASTSIDE_CRON ?? DEFAULT_CRON).trim();
  const cronExpr = rawCron.length > 0 ? rawCron : DEFAULT_CRON;
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : true;
  const limit = Math.min(Math.max(input.limit ?? getEnvNumber('BYEASTSIDE_SYNC_LIMIT', 10), 1), 200);
  const pageSize = Math.min(Math.max(input.pageSize ?? getEnvNumber('BYEASTSIDE_PAGE_SIZE', 10), 1), 100);
  const page = Math.min(Math.max(input.page ?? getEnvNumber('BYEASTSIDE_SYNC_PAGE', 1), 1), 1000);
  return { cron: cronExpr, enabled, limit, pageSize, page };
};

const ensureDataSource = async () => {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
};

const loadSettings = async (): Promise<ByeastsideSettings> => {
  await ensureDataSource();
  const repo = dataSource.getRepository(AppSetting);
  const row = await repo.findOne({ where: { key: SETTINGS_KEY } });
  return normalizeSettings((row?.value as Partial<ByeastsideSettings>) ?? {});
};

const runOnce = async () => {
  const apiKey = getEnv('BYEASTSIDE_API_KEY');
  const apiBase = process.env.BYEASTSIDE_API_BASE || 'https://byeastside.uk/api/customer/pdfs';
  const labelsBase = process.env.BYEASTSIDE_LABELS_BASE || 'https://api-label-scan.aletech.co/api/customer/pdfs';

  const settings = await loadSettings();
  const result = await runByeastsideSync({
    dataSource,
    apiKey,
    apiBase,
    labelsBase,
    limit: settings.limit,
    page: settings.page,
    pageSize: settings.pageSize,
  });

  // eslint-disable-next-line no-console
  console.log('[byeastside-sync] Result:', result);
};

const main = async () => {
  const settings = await loadSettings();
  const cronExpr = settings.cron || DEFAULT_CRON;
  const runOnStart = (process.env.BYEASTSIDE_RUN_ON_START || '').toLowerCase() === 'true';
  const exitAfterRun = (process.env.BYEASTSIDE_EXIT_AFTER_RUN || '').toLowerCase() === 'true';

  if (runOnStart) {
    await runOnce();
    if (exitAfterRun) {
      return;
    }
  }

  if (!settings.enabled) {
    // eslint-disable-next-line no-console
    console.log('[byeastside-sync] Auto sync disabled by settings.');
    return;
  }

  if (!cron.validate(cronExpr)) {
    throw new Error(`Invalid BYEASTSIDE_CRON: ${cronExpr}`);
  }

  cron.schedule(
    cronExpr,
    () => {
      runOnce().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[byeastside-sync] Failed:', err);
      });
    },
    { timezone: TZ },
  );

  // eslint-disable-next-line no-console
  console.log(`[byeastside-sync] Scheduled ${cronExpr} (${TZ}).`);
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[byeastside-sync] Fatal:', err);
  process.exit(1);
});
