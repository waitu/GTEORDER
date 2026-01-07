# GTE Order Auth Service

Seed NestJS-based auth service with pending registration, OTP, and trusted devices.

## Quick start
1. `npm install`
2. Copy `.env.example` to `.env` and adjust secrets.
3. `docker-compose up -d` (Postgres + Redis)
4. `npm run start:dev`

## Notes
- ESM TypeScript configuration (NodeNext). Imports use explicit `.js` extensions.
- Entities and services align with `docs/auth-system-design.md` schema.
- Next steps: add controllers (auth/register/login/otp), rate-limit guards, email provider implementation, migrations (TypeORM).

## Database migrations

- This project uses explicit TypeORM migrations for schema changes. Do NOT rely on `synchronize` in production.
- To run migrations (after building `dist`):

```powershell
npm run build;
npm run typeorm:migration:run
```

- To revert the last migration:

```powershell
npm run typeorm:migration:revert
```

Environment flags:
- `DB_SYNC` / `DB_SYNC=false` — ensure false in production.
- `LABEL_DEBIT_ON_IMPORT` — if `true` label imports may debit user balance on import; default is `false`.

If you add new migrations, commit them under `src/migrations/` so deploy builds pick them up.
