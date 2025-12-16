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
