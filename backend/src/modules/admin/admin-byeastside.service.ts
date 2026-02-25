import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { AppSetting } from '../../shared/config/app-setting.entity.js';
import { runByeastsideSync } from '../../shared/integrations/byeastside-sync.js';
import { UpdateByeastsideSettingsDto, RunByeastsideSyncDto } from './dto/byeastside-settings.dto.js';

export type ByeastsideSettings = {
  cron: string;
  enabled: boolean;
  limit: number;
  pageSize: number;
  page: number;
};

const SETTINGS_KEY = 'byeastside_sync';
const DEFAULT_CRON = '0 21 * * *';

@Injectable()
export class AdminByeastsideService {
  constructor(private readonly dataSource: DataSource, private readonly config: ConfigService) {}

  private getEnvNumber(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return value;
  }

  private normalizeSettings(input: Partial<ByeastsideSettings>): ByeastsideSettings {
    const rawCron = (input.cron ?? this.config.get<string>('BYEASTSIDE_CRON') ?? DEFAULT_CRON).trim();
    const cron = rawCron.length > 0 ? rawCron : DEFAULT_CRON;
    const enabled = typeof input.enabled === 'boolean' ? input.enabled : true;
    const limit = Math.min(Math.max(input.limit ?? this.getEnvNumber('BYEASTSIDE_SYNC_LIMIT', 10), 1), 200);
    const pageSize = Math.min(Math.max(input.pageSize ?? this.getEnvNumber('BYEASTSIDE_PAGE_SIZE', 10), 1), 100);
    const page = Math.min(Math.max(input.page ?? this.getEnvNumber('BYEASTSIDE_SYNC_PAGE', 1), 1), 1000);
    return { cron, enabled, limit, pageSize, page };
  }

  private async settingsRepo() {
    return this.dataSource.getRepository(AppSetting);
  }

  async getSettings(): Promise<ByeastsideSettings> {
    const repo = await this.settingsRepo();
    const row = await repo.findOne({ where: { key: SETTINGS_KEY } });
    const settings = this.normalizeSettings((row?.value as Partial<ByeastsideSettings>) ?? {});
    return settings;
  }

  async updateSettings(dto: UpdateByeastsideSettingsDto): Promise<ByeastsideSettings> {
    const repo = await this.settingsRepo();
    const existing = await repo.findOne({ where: { key: SETTINGS_KEY } });
    const merged = this.normalizeSettings({ ...(existing?.value as Partial<ByeastsideSettings>), ...dto });

    const entity = repo.create({
      key: SETTINGS_KEY,
      value: merged,
    });
    await repo.save(entity);
    return merged;
  }

  async syncNow(dto?: RunByeastsideSyncDto) {
    const apiKey = this.config.get<string>('BYEASTSIDE_API_KEY');
    const apiBase = this.config.get<string>('BYEASTSIDE_API_BASE') || 'https://byeastside.uk/api/customer/pdfs';
    const labelsBase = this.config.get<string>('BYEASTSIDE_LABELS_BASE') || 'https://api-label-scan.aletech.co/api/customer/pdfs';

    if (!apiKey) {
      throw new Error('Missing BYEASTSIDE_API_KEY');
    }

    const settings = this.normalizeSettings({ ...(await this.getSettings()), ...dto });

    return runByeastsideSync({
      dataSource: this.dataSource,
      apiKey,
      apiBase,
      labelsBase,
      limit: settings.limit,
      page: settings.page,
      pageSize: settings.pageSize,
    });
  }
}
