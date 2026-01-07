# Auth & Registration Design

## Scope & Assumptions
- Web app kiểm đơn hàng; auth via email/password + OTP email as step-up.
- Account lifecycle: register -> pending -> admin approve -> active; reject keeps user disabled.
- OTP only via email; device trust reduces OTP prompts.
- Stateless access tokens, refresh tokens per device; Redis for rate-limit/OTP TTL; relational DB for persistence.

## Data Model (tables)
- `users`: id (pk, uuid), email (unique, lower), password_hash, status (pending|active|disabled|rejected), last_login_at, created_at, updated_at.
- `user_profiles`: user_id (pk, fk users.id), full_name, phone, role (admin|user), metadata jsonb.
- `registration_requests`: id (pk, uuid), user_id (fk), state (pending|approved|rejected), reviewed_by (fk users.id), reviewed_at, reason, created_at.
- `otp_codes`: id (pk, uuid), user_id (fk), code_hash, channel (email), purpose (login|device_trust), expires_at, attempts, max_attempts, used_at, sent_at, request_id (opaque returned to client), created_at.
- `trusted_devices`: id (pk, uuid), user_id (fk), device_token_hash, device_fingerprint, device_name, last_ip, last_used_at, expires_at, revoked_at, created_at.
- `refresh_tokens`: id (pk, uuid), user_id (fk), device_id (fk trusted_devices.id), token_hash, expires_at, revoked_at, created_at, rotated_from, rotated_to.
- `login_audit`: id (pk), user_id, ip, user_agent, device_fingerprint, result (success|fail), reason, created_at.
- `admin_audit`: id (pk), admin_id, action, target_id, payload, created_at.
- Recommended indexes: unique(email), idx on status, expires_at (otp, refresh, trusted_devices), composite (user_id, request_id) on otp_codes.

## Tokens
- Access token: JWT 5–15m exp; includes user_id, role; signed HS/RS; include jti for audit.
- Refresh token: opaque or JWT; stored hashed in `refresh_tokens`; exp 7–30d; rotation on each refresh; bind to device_id + ip range.
- Device token: JWT/HMAC; claims {user_id, device_id, fingerprint_hash, exp 30–90d}; stored hashed in `trusted_devices`; revoked on password change or admin reset.

## Flows
### Registration (pending -> approve)
1) POST `/auth/register` (email, password, profile). Validate, hash password (Argon2id), create user status=pending, create registration_request pending.
2) Email confirmation optional; return generic success.
3) Admin GET `/admin/registrations?state=pending` to review; approve/reject via POST `/admin/registrations/{id}/approve|reject` (require admin MFA).
4) Approve -> users.status=active, record admin_audit, send notification. Reject -> users.status=rejected or keep pending with reason.

### Login with OTP email
1) POST `/auth/login` (email, password, device_fingerprint?, device_token?). Enforce rate-limit per IP+email.
2) If status!=active -> 403 generic. If password wrong -> increment fail counters, log audit.
3) If valid password:
   - If device_token provided: verify signature, match hash in `trusted_devices`, check exp, fingerprint match -> issue access+refresh; update last_used_at; audit success.
   - Else: create OTP (6–8 digits), hash store in `otp_codes` with TTL 5–10m, attempts=0, max_attempts=5, request_id opaque. Enqueue email. Return {otp_request_id} with message requiring OTP.

### OTP verify
1) POST `/auth/otp/verify` (otp_request_id, code, device_name?, device_fingerprint?, trust_device?).
2) Lookup otp_codes by request_id & user; check not used/expired, attempts<max. If fail: attempts++, maybe lockout after max; audit failure.
3) If correct: mark used_at, audit success, issue access+refresh.
4) If trust_device=true: create device_id + device_token (exp 30–90d), store hash+fingerprint in `trusted_devices`, return device_token to client (httpOnly cookie or secure storage).

### Refresh
- POST `/auth/refresh` with refresh token (httpOnly cookie). Validate hash & not revoked & bound to device. Rotate: create new refresh, revoke old (rotated_to). Detect reuse -> revoke session chain and force OTP login.

### Logout
- POST `/auth/logout`: revoke refresh token (and optionally device token). Server-side delete from DB.

### OTP resend (optional `/auth/otp/send`)
- Allow resend only if previous OTP expired or cooldown passed (60s). Cap sends 3–5 per hour per user; rate-limit per IP.

### Device management
- GET `/me/devices`: list trusted devices; show last_used_at, device_name, expires_at.
- POST `/me/devices/{id}/revoke`: revoke device_token_hash; invalidate refresh tokens for that device.
- Auto-revoke all trusted devices & refresh tokens on password change or admin reset.

## Rate-Limit & Anti-Abuse (tunable defaults)
- `/auth/login`: max 5 attempts / 15m per IP; max 5 / 15m per email.
- OTP send: max 3 per hour per user; cooldown 60s between sends; max 10 per day per user; per-IP cap.
- OTP verify: max_attempts=5 per request_id; additionally 10 / hour per user.
- Admin endpoints: IP allowlist + MFA; low rate limits.
- Soft lockout: after repeated failures, block login for 15–30m; require captcha after N failures.

## Security Best Practices
- Password hashing: Argon2id (memory-hard) or bcrypt with strong cost; never store plaintext; enforce password policy.
- Sensitive storage: hash OTP codes; store tokens hashed (HMAC or bcrypt) server-side.
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` (or Strict for logout-sensitive flows), `Domain` scoped.
- TLS + HSTS; CSRF token on state-changing requests if cookies used; CORS locked to origin.
- Validate all inputs (email format, device_fingerprint length); uniform error messages to avoid user enumeration.
- JWT signing keys rotated; keep key IDs (kid) and support dual validation during rotation.
- Audit everything: login success/fail, OTP sent/verified, device trust/revoke, admin actions. Monitor anomaly spikes.
- Email content: do not echo password; include request time/IP; short-lived OTP; include support contact.
- Backup & retention: periodic DB backups; redact PII in logs; set TTL for OTP/login audits if required by policy.

## API Contract Summary
- `POST /auth/register`: {email, password, full_name?, phone?} -> 200 ok (pending). Errors: 400 validation, 409 email exists.
- `POST /auth/login`: {email, password, device_fingerprint?, device_token?} -> 200 {need_otp, otp_request_id?} or tokens. Errors: 401/403, 429.
- `POST /auth/otp/verify`: {otp_request_id, code, trust_device?, device_name?, device_fingerprint?} -> tokens (+device_token if trusted). Errors: 400/401/410 expired/429.
- `POST /auth/refresh`: cookie refresh -> 200 new tokens or 401 on reuse detected.
- `POST /auth/logout`: revoke refresh (and device token optional) -> 204.
- `GET /me`: profile; requires access token.
- `GET /me/devices`, `POST /me/devices/{id}/revoke`: manage trusted devices.
- `GET /admin/registrations?state=pending|approved|rejected`, `POST /admin/registrations/{id}/approve|reject`: admin only; enforce MFA and audit.

## Operational Notes
- Use Redis for rate-limit buckets and OTP TTL; use idempotent OTP request IDs to avoid duplicate sends.
- Email sending via async queue; retries with exponential backoff; drop after max retries and note in audit.
- On suspicious activity (multiple failures, new country), require OTP even for trusted devices.
- Provide config flags for all limits (env vars) and per-tenant overrides if multi-tenant later.
