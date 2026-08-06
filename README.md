# Barcode Tracker

An installable **PWA** for tracking barcode batches and keeping their serial sequence continuous and accountable. Backed by a real **SQLite** database, with **role-based access** enforced on the server. Includes **multistep JWT authentication** (password + optional TOTP) and a **super admin** tier for full user/role/study control.

The app is split into a **Node/Express MVC API** (`backend/`) and a **React + Vite + Tailwind** frontend (`frontend/`).

Pre-seeded with the studies and barcode ranges from the original handwritten ledger.

---

## Quick start

Requires **Node.js 22.5+** (uses Node's built-in SQLite — no native build step).

```bash
npm install
npm run dev
```

- **API:** http://localhost:3000  
- **Frontend (dev):** http://localhost:5173 — Vite proxies `/api` and `/uploads` to the backend

Use **`npm run dev`** (not `npm start` alone) during development — it starts **both** the API and the Vite dev server. Open the UI at **http://localhost:5173**.

Verify the connection: http://localhost:3000/api/health should return `{ "ok": true }`.

First run creates `data/barcode.db` and an `uploads/` folder for barcode photos. By default it bootstraps a **single super-admin** account with a **random password printed once to the console** — copy it from the startup logs and change it after signing in. To instead load the demo accounts and sample ledger (local dev only), start with `SEED_DEMO=1`.

### Production-style run

```bash
npm run build
npm start
```

Serves the built React app and API from http://localhost:3000.

> **Upgrading from v1.x?** Just start it — the database migrates in place. Existing admins may be promoted to `super_admin`, MFA columns are added, and your batches are preserved.

### Demo accounts (opt-in — `SEED_DEMO=1` only)

These weak, publicly-known logins are **not** created by default. They load only when you start the app with `SEED_DEMO=1`, for local demos:

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin` | `super123` |
| Admin | `admin` | `admin123` |
| Operator | `operator` | `operator123` |
| User | `user` | `user123` (assigned to FLU RSV IMPACT + Sensorflu) |

```bash
SEED_DEMO=1 npm run dev
```

Tap any account on the login screen to fill the form. **Never set `SEED_DEMO` in production.**

---

## Project layout

```
Barcode-tracker/
├── backend/                    Express MVC API
│   ├── server.js               Entry point
│   ├── app.js                  Express app wiring
│   ├── config/                 Environment & paths
│   ├── controllers/            Request handlers (MVC)
│   ├── models/                 Data access layer (incl. RefreshTokenModel)
│   ├── routes/                 Route definitions
│   ├── services/               Business logic (auth, oauth, photos, scope)
│   ├── middleware/             auth (JWT/roles/refresh), cors,
│   │                           securityHeaders, rateLimit, signedUploads
│   └── utils/                  Permissions & serial helpers
├── frontend/                   React + Vite + Tailwind
│   ├── src/
│   │   ├── api/                API client (cookie refresh)
│   │   ├── components/         Shared UI
│   │   ├── context/            Auth & theme
│   │   ├── pages/              Route views
│   │   └── utils/              Formatting, images
│   └── vite.config.js
├── .github/                    CI (ci.yml, security.yml), dependabot.yml
├── security-scan.sh            Local npm audit + Strix + Snyk runner
├── SECURITY-SCAN.md            Security audit + remediation notes
├── data/                       SQLite database (runtime)
└── uploads/                    Barcode photos (runtime)
```

---

## Authentication (multistep JWT)

1. **Step 1 — credentials:** `POST /api/auth/login` with username + password  
   - Returns a JWT **access token** in the body (+ sets the refresh cookie) if 2FA is **off**  
   - Returns `{ step: "mfa", mfa_token }` if 2FA is **on**

2. **Step 2 — TOTP (when enabled):** `POST /api/auth/verify-mfa` with `mfa_token` + 6-digit code  
   - Returns the access token and sets the refresh cookie

3. **Token refresh:** `POST /api/auth/refresh` — no body; the **refresh token is an httpOnly cookie** (`SameSite=Lax`, `Secure` in production, scoped to `/api/auth`). Each refresh **rotates** the token and revokes the old one.

4. **Logout:** `POST /api/auth/logout` — revokes the refresh token server-side and clears the cookie.

The short-lived **access token** (12h) is returned in the response body for the `Authorization: Bearer` header; the **refresh token** (7d) never touches JavaScript — it lives only in the cookie and is tracked in a `refresh_tokens` table so it can be rotated and revoked. The web client auto-refreshes once on a `401`.

**Brute-force protection:** the auth endpoints are rate-limited per IP (login 10 / 15 min, verify-mfa 5 / 5 min, register 5 / hr, refresh 30 / 15 min), returning `429` with `Retry-After`.

Enable 2FA under **Security** in the sidebar (Google Authenticator, Authy, etc.).

`JWT_SECRET` is auto-generated and written to `.env` on first run if unset; set it explicitly in production. Optional: `MFA_ISSUER` for the authenticator app label.

> **Split-origin deploys:** the refresh cookie is `SameSite=Lax`, which works same-origin (unified `npm start`) and for the localhost dev split. If you host the SPA and API on **different domains**, change it to `SameSite=None; Secure` in `backend/middleware/auth.js` (`refreshCookieOptions`).

### Social sign-in (Google / Microsoft)

The login screen offers **Continue with Google** and **Continue with Microsoft**. OAuth completes with the same access token + refresh cookie as password login. Linking a social login to an existing local account requires a **provider-verified email**, to prevent account takeover.

1. Copy `.env.example` to `.env` and set provider credentials.
2. Register redirect URIs in each provider console:
   - Google: `http://localhost:3000/api/auth/google/callback`
   - Microsoft: `http://localhost:3000/api/auth/microsoft/callback`
3. Add each user's **work email** to their account (required for OAuth matching). New users can include an email when created under **Users**.

If 2FA is enabled on the account, OAuth still requires the TOTP step after provider sign-in.

---

## Roles

| Capability | User | Operator | Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|
| View dashboard & batches | assigned studies only | all | all | all |
| Record a batch | assigned studies only | any study | any study | any study |
| Manage studies | | | ✓ | ✓ |
| Manage users & study access | | | ✓ (operator/user roles) | ✓ (all roles) |
| Promote/demote admins | | | | ✓ |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + Vite dev server concurrently (recommended for development) |
| `npm run dev:backend` | API only (port 3000) |
| `npm run dev:frontend` | Vite dev server only (port 5173) |
| `npm run build` | Build React app to `frontend/dist` |
| `npm start` | Run API (serves built frontend if present) |

---

## Security

Built-in protections (all zero-dependency, enforced server-side):

- **Auth hardening** — bcrypt password hashing, optional TOTP 2FA, per-IP rate limiting on auth endpoints, and a refresh-token store with rotation + revocation (see [Authentication](#authentication-multistep-jwt)).
- **HTTP security headers** (`backend/middleware/securityHeaders.js`) — a tuned **CSP**, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, COOP/CORP, and HSTS in production. (Equivalent to helmet's defaults, without the dependency.)
- **Signed upload URLs** — barcode photos under `/uploads` are served only with a short-lived HMAC signature (1h) that's minted exclusively by authenticated, study-scoped endpoints, so photos can't be reached by guessing URLs or across studies.
- **Non-enumerable registration** — `POST /api/auth/register` returns an identical response whether or not the email exists (timing equalized), so accounts can't be enumerated.
- **Locked-down CORS** — requests are limited to an allowlist of origins; permissive reflection is opt-in via `CORS_ALLOW_ALL=1` (local dev only).
- **Parameterized SQL everywhere** — no string-built queries.

Secrets live in a **gitignored `.env`** (copy from `.env.example`, which holds placeholders only). `data/` and `uploads/` are gitignored too. Never commit real credentials — GitHub push protection is enabled on the repo.

A full audit with per-finding remediation is in [`SECURITY-SCAN.md`](./SECURITY-SCAN.md). Run the local scan any time with `bash security-scan.sh` (npm audit + Strix + Snyk, in a Docker-enabled environment).

---

## Continuous security (CI/CD)

GitHub Actions under `.github/`:

- **`ci.yml`** — on every push/PR: installs deps, runs the security middleware self-checks (`rateLimit.js`, `signedUploads.js`), and `npm audit --omit=dev`.
- **`security.yml`** — Snyk **Open Source** (SCA) + **Snyk Code** (SAST) on push/PR and weekly. Uploads SARIF to the **Security → Code scanning** tab, **emails** on high-or-above findings, and **fails the build on any critical**. Also runs `snyk monitor` on `main` for continuous dashboard tracking.
- **`dependabot.yml`** — weekly dependency PRs for backend npm, frontend npm, and GitHub Actions.

Required repository secret: `SNYK_TOKEN`. Optional (for the alert email): `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_TO`. Optional variable: `SNYK_ORG` (overrides the default org).

---

## Environment variables

Copy `.env.example` → `.env`. Common keys:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signing key; auto-generated to `.env` on first run if unset. Set explicitly in production. |
| `PORT` / `DB_PATH` / `UPLOAD_DIR` | API port, SQLite path, upload folder. |
| `MFA_ISSUER` | Label shown in authenticator apps. |
| `SEED_DEMO` | `1` loads demo accounts + sample ledger (dev only). Unset in production. |
| `CORS_ALLOW_ALL` | `1` reflects any CORS origin (dev only). Unset in production. |
| `FRONTEND_URL` / `API_PUBLIC_URL` | Origins used for CORS allowlist and OAuth redirects. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google OAuth. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` / `MICROSOFT_REDIRECT_URI` | Microsoft OAuth. |
| `VITE_API_BASE` | Frontend → backend base URL (leave empty in dev to use the Vite proxy). |

---

## Notes for production

- Set `JWT_SECRET`, and optionally `PORT`, `DB_PATH`, `UPLOAD_DIR`, `MFA_ISSUER`.
- Leave `SEED_DEMO` and `CORS_ALLOW_ALL` **unset** — they're dev-only.
- Change the first-run super-admin password immediately, and require 2FA for super-admin accounts.
- For split-origin hosting, switch the refresh cookie to `SameSite=None; Secure` (see [Authentication](#authentication-multistep-jwt)).
- Serve over HTTPS — required for `Secure` cookies, HSTS, and PWA installability.
