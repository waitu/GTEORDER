import * as Joi from 'joi';
export const envValidationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().port().default(3000),
    DATABASE_URL: Joi.string().uri().required(),
    DB_SSL: Joi.boolean().default(false),
    REDIS_URL: Joi.string().uri().required(),
    JWT_ACCESS_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    JWT_DEVICE_SECRET: Joi.string().min(32).required(),
    ACCESS_TOKEN_TTL: Joi.number().default(900),
    REFRESH_TOKEN_TTL: Joi.number().default(60 * 60 * 24 * 14),
    DEVICE_TOKEN_TTL: Joi.number().default(60 * 60 * 24 * 60),
    OTP_EMAIL_FROM: Joi.string().email().required(),
    SMTP_HOST: Joi.string().required(),
    SMTP_PORT: Joi.number().port().required(),
    SMTP_USER: Joi.string().required(),
    SMTP_PASS: Joi.string().required(),
});
//# sourceMappingURL=env.validation.js.map