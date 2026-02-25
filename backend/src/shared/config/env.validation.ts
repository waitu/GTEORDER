import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string().uri().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_SYNC: Joi.boolean().optional(),

  REDIS_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_DEVICE_SECRET: Joi.string().min(32).required(),

  ACCESS_TOKEN_TTL: Joi.number().default(900),
  REFRESH_TOKEN_TTL: Joi.number().default(60 * 60 * 24 * 14),
  DEVICE_TOKEN_TTL: Joi.number().default(60 * 60 * 24 * 60),

  AUTH_TOKEN_MODE: Joi.string().valid('cookie', 'body').default('body'),

  HIBP_ENABLED: Joi.boolean().default(false),

  OTP_SEND_LIMIT_IP: Joi.number().default(20),
  OTP_SEND_WINDOW_IP: Joi.number().default(60 * 60),
  OTP_SEND_LIMIT_EMAIL: Joi.number().default(5),
  OTP_SEND_WINDOW_EMAIL: Joi.number().default(15 * 60),

  OTP_EMAIL_FROM: Joi.string().email().required(),
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().port().required(),
  SMTP_SECURE: Joi.boolean().default(true),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),

  LABEL_DEBIT_ON_IMPORT: Joi.boolean().default(false),

  BYEASTSIDE_API_KEY: Joi.string().optional(),
  BYEASTSIDE_API_BASE: Joi.string().uri().default('https://byeastside.uk/api/customer/pdfs'),
  BYEASTSIDE_LABELS_BASE: Joi.string().uri().default('https://api-label-scan.aletech.co/api/customer/pdfs'),
  BYEASTSIDE_PAGE_SIZE: Joi.number().integer().min(1).max(100).default(10),
  BYEASTSIDE_SYNC_LIMIT: Joi.number().integer().min(1).max(200).default(10),
  BYEASTSIDE_SYNC_PAGE: Joi.number().integer().min(1).max(1000).default(1),
  BYEASTSIDE_CRON: Joi.string().optional(),
  BYEASTSIDE_RUN_ON_START: Joi.boolean().default(false),
  BYEASTSIDE_EXIT_AFTER_RUN: Joi.boolean().default(false),
});
