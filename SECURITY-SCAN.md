# Barcode Tracker — Security Scan

**Date:** 2026-08-05
**Scope:** `backend/` (Express + node:sqlite API), `frontend/src/` auth & API client, config, repo hygiene.
**Method:** Static analysis (SAST-style manual review, "Strix-like"). The Strix tool itself is a dynamic-analysis agent that needs Docker to run the live app and attack it; the sandbox VM was unavailable this session, so **no dynamic/DAST testing or `npm audit` was run**. Findings below are from reading the code. Re-run Strix and `npm audit` in a Docker-enabled environment to confirm exploitability and catch dependency CVEs.

## Summary

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | High | Default seeded accounts with weak, publicly-known passwords | **Fixed** |
| 2 | High | No rate limiting / lockout on auth endpoints (password + TOTP brute force) | **Fixed** |
| 3 | Medium | CORS reflects any origin with credentials when `NODE_ENV !== 'production'` (fails open) | **Fixed** |
| 4 | Medium | JWT access + 7-day refresh tokens in `localStorage`; no refresh revocation/rotation | **Fixed** |
| 5 | Medium | No HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) | **Fixed** |
| 6 | Low-Med | `/uploads` served unauthenticated — batch photos bypass study-scope access control | **Fixed** |
| 7 | Low | Account/email enumeration on registration | **Fixed** |
| 8 | Low | OAuth email-based linking can take over a pre-existing local account if provider email is unverified | **Fixed** |

All eight findings are now addressed in code.

### Remediation applied (2026-08-05)
- **#1** `models/database.js` — demo accounts (`super123` etc.) and sample ledger now only load with `SEED_DEMO=1`. Default first run creates one `superadmin` with a random password printed once to the console.
- **#2** new `middleware/rateLimit.js` (zero-dependency in-memory limiter) wired into `routes/authRoutes.js`: login 10/15min, verify-mfa 5/5min, register 5/hr, refresh 30/15min per IP. Returns `429` + `Retry-After`.
- **#3** `middleware/cors.js` — permissive origin reflection is now opt-in via `CORS_ALLOW_ALL=1`, not the absence of a production flag. On disallowed origins no `Access-Control-Allow-Origin` is sent, so the browser blocks the response.
- **#5** new `middleware/securityHeaders.js` (extracted from `app.js`): CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-Permitted-Cross-Domain-Policies: none`, `X-DNS-Prefetch-Control: off`, `X-XSS-Protection: 0`, and HSTS (production). **helmet was deliberately not added** — these are the same headers helmet sets by default, and pulling in a runtime dependency to set ~10 static headers is the kind of bloat ponytail exists to avoid. Say so if you'd rather have the helmet dependency and I'll swap it in.

**Item 1 (Strix + `npm audit`)** can't run in this session (no Docker/VM; Snyk needs interactive auth). Delivered `security-scan.sh` at the repo root instead — run it in a Docker-enabled Linux/WSL environment: `bash security-scan.sh`. It runs `npm audit --omit=dev` (backend + frontend), Strix DAST if installed, and Snyk if installed.
- **#8** `services/oauthService.js` + `controllers/authController.js` — linking an OAuth login to an existing local account now requires a provider-verified email (`email_verified` for Google; a provisioned `mail` for Microsoft, not a bare UPN).

> Not runnable-verified this session (sandbox VM was unavailable). Run `node backend/middleware/rateLimit.js` for the limiter self-check and `npm --prefix backend start` to smoke-test before deploying. If the SPA fails to load, loosen the CSP `script-src`/`style-src` before removing the header.

### Remediation applied (larger changes)
- **#4** Refresh token moved out of `localStorage` into an httpOnly, `SameSite=Lax`, `Secure`-in-prod cookie scoped to `/api/auth`, with rotation + revocation:
  - `models/database.js` + `models/RefreshTokenModel.js` — a `refresh_tokens` table stores one row per issued `jti`.
  - `middleware/auth.js` — `issueRefreshCookie` records a random `jti` and sets the cookie; `rotateRefresh` verifies the cookie, checks the `jti` is present/unrevoked/unexpired, revokes it (one-time use), and issues a fresh one; `revokeRefreshCookie` powers logout.
  - `controllers/authController.js` — login/verify-mfa/onboarding/OAuth now set the cookie; `/auth/refresh` is cookie-based; new `/auth/logout` revokes server-side. `services/oauthService.js` no longer puts the refresh token in the redirect URL.
  - Frontend `api/client.js` — stops storing the refresh token, sends `credentials: 'include'`, and does one silent cookie-refresh + retry on a 401; `signOut` calls `/auth/logout`.
- **#6** new `middleware/signedUploads.js` — batch photo URLs are returned already HMAC-signed with a 1h expiry (one response choke-point covers every endpoint), and the `/uploads` static route rejects any request without a valid, unexpired signature (`timingSafeEqual`). Signatures are only ever minted inside authenticated, study-scoped endpoints, so the scope-bypass is closed too — and `<img>` tags keep working because the signature rides the URL, not an auth header.
- **#7** `controllers/authController.js` — register now returns an identical `202 { ok: true }` whether or not the email exists, runs a bcrypt hash on both paths to equalize timing, and no longer auto-logs-in. Frontend routes to `/login?registered=1` with a neutral banner.

### Deployment caveats for the new auth
- **Split-origin production** (e.g. `app.example.com` + `api.example.com`) is cross-site, so the `SameSite=Lax` refresh cookie won't be sent — switch it to `SameSite=None; Secure` in `middleware/auth.js:refreshCookieOptions`. Same-origin (unified `npm start`) needs no change.
- **Dev image loading** relies on Vite proxying `/uploads` (and `/api`) to the backend; the appended `?exp&sig` query doesn't affect proxy matching.
- Run the self-checks before deploy: `node backend/middleware/rateLimit.js` and `node backend/middleware/signedUploads.js` (couldn't run here — sandbox VM was down).

**Clean / done well:** all SQL uses parameterized statements (no SQL injection found), passwords hashed with bcrypt, TOTP MFA, OAuth `state` is a signed JWT (CSRF-protected), photo upload validates a data-URL allowlist with server-generated filenames (no path traversal / arbitrary write), `.env` and `data/` are gitignored.

---

## Findings

### 1. Default seeded credentials — High
`backend/models/database.js:142-150` seeds four accounts on an empty DB with hardcoded passwords: `superadmin`/`super123`, `admin`/`admin123`, `operator`/`operator123`, `user`/`user123`. These are in source and grant full `super_admin` control. Any deployment that boots with an empty DB and isn't immediately hardened is fully compromised by a known password.

**Fix:** don't seed real login accounts in non-dev. Gate seeding behind an explicit `SEED_DEMO=1` flag, or force a password change on first login, or generate a random super-admin password and print it once to the console.

### 2. No brute-force protection on auth — High
`backend/routes/authRoutes.js` — `/login`, `/verify-mfa`, `/register`, `/refresh` have no rate limiting, throttling, or account lockout. Passwords can be sprayed unlimited; the 6-digit TOTP at `verify-mfa` (`middleware/auth.js:12`, `window:1`) can be brute-forced within the 5-minute `mfa_pending` window.

**Fix:** add per-IP + per-account rate limiting (e.g. `express-rate-limit`) on auth routes; lock or exponentially back off after N failed TOTP attempts.

### 3. CORS fails open outside production — Medium
`backend/middleware/cors.js:15` — `allowedOrigins.has(origin) || !config.isProduction`. `isProduction` is only true when `NODE_ENV === 'production'` is explicitly set (`config/index.js:56`). If that env var is missing in a real deployment, the server reflects **any** `Origin` back and sets `Access-Control-Allow-Credentials: true`, letting any website make credentialed cross-origin calls.

**Fix:** default to the strict allowlist regardless of `NODE_ENV`; make the permissive branch opt-in via an explicit `CORS_DEV=1` flag, not the absence of a production flag.

### 4. Tokens in localStorage, no refresh revocation — Medium
`frontend/src/api/client.js:29-34` stores access + refresh tokens in `localStorage`; any XSS steals both. Refresh tokens (`middleware/auth.js:37`, 7-day) are stateless — `authController.refresh` mints a new access token with no rotation and no server-side revocation list, so a stolen refresh token is valid for its full lifetime and can't be killed.

**Fix:** prefer httpOnly + Secure + SameSite cookies for the refresh token; add rotation + a revocation/`jti` denylist (or short refresh lifetime). At minimum, ship a strict CSP (see #5) to reduce XSS token theft.

### 5. Missing security headers — Medium
`backend/app.js` sets no security headers. No `Content-Security-Policy` (defense-in-depth vs XSS → relevant to #4), no `Strict-Transport-Security`, no `X-Frame-Options`/frame-ancestors (clickjacking), no `X-Content-Type-Options: nosniff`.

**Fix:** add `helmet` (one line) with a tuned CSP.

### 6. Unauthenticated `/uploads` — Low-Medium
`backend/app.js:18` serves `config.uploadDir` statically with no auth. Batch photos (`start_photo`/`end_photo`) are reachable by anyone with the URL, bypassing the study-scope checks that gate `/api/batches`. Filenames include 4 random bytes so they're hard to guess, but URLs leak via history/logs/referrer and there's no per-study authorization on the file itself.

**Fix:** serve uploads through an authenticated route that re-checks `accessibleStudyIds` for the owning batch, or use signed, expiring URLs.

### 7. Registration enumeration — Low
`backend/controllers/authController.js:74` returns `409 "An account with this email already exists."`, letting anyone probe which emails are registered. (`/auth/providers` and `/auth/signup/studies` are also public but low-value.)

**Fix:** return a generic success/"check your email" response and handle duplicates out-of-band.

### 8. OAuth account linking by email — Low
`backend/controllers/authController.js:124` matches `findByOAuth(...) || findByEmail(profile.email)`, then links the OAuth identity to whatever local account owns that email. Google emails are verified, but the Microsoft path (`services/oauthService.js:106`) falls back to `userPrincipalName` with `tenantId` defaulting to `common`, so an attacker-controlled directory could present an unverified address matching a victim's local account and take it over.

**Fix:** only auto-link when the provider asserts the email is verified (`email_verified` / verified `mail`); otherwise require an explicit link step while logged in.

---

## Recommended next steps
1. **Done / handed off** — run `bash security-scan.sh` in a Docker-enabled env for Strix DAST + `npm audit` + optional Snyk (couldn't execute this session).
2. **Done** — demo seeding gated (#1) and auth rate limiting added (#2) before any shared/production deploy.
3. **Done** — security headers added (#5, without the helmet dependency) and CORS tightened to opt-in (#3).
4. **Done** — refresh-token cookies + rotation (#4), signed `/uploads` (#6), and non-enumerable registration (#7) all implemented. See remediation notes above and the deployment caveats.
