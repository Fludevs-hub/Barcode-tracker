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

First run creates `data/barcode.db`, seeds demo accounts + ledger data, and creates an `uploads/` folder for barcode photos.

### Production-style run

```bash
npm run build
npm start
```

Serves the built React app and API from http://localhost:3000.

> **Upgrading from v1.x?** Just start it — the database migrates in place. Existing admins may be promoted to `super_admin`, MFA columns are added, and your batches are preserved.

### Demo accounts

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin` | `super123` |
| Admin | `admin` | `admin123` |
| Operator | `operator` | `operator123` |
| User | `user` | `user123` (assigned to FLU RSV IMPACT + Sensorflu) |

Tap any account on the login screen to fill the form.

---

## Project layout

```
Barcode-tracker/
├── backend/                    Express MVC API
│   ├── server.js               Entry point
│   ├── app.js                  Express app wiring
│   ├── config/                 Environment & paths
│   ├── controllers/            Request handlers (MVC)
│   ├── models/                 Data access layer
│   ├── routes/                 Route definitions
│   ├── services/               Business logic
│   ├── middleware/             Auth (JWT, roles)
│   └── utils/                  Permissions helpers
├── frontend/                   React + Vite + Tailwind
│   ├── src/
│   │   ├── api/                API client
│   │   ├── components/         Shared UI
│   │   ├── context/            Auth & theme
│   │   ├── pages/              Route views
│   │   └── utils/              Formatting, images
│   └── vite.config.js
├── data/                       SQLite database (runtime)
└── uploads/                    Barcode photos (runtime)
```

---

## Authentication (multistep JWT)

1. **Step 1 — credentials:** `POST /api/auth/login` with username + password  
   - Returns JWT access + refresh tokens if 2FA is **off**  
   - Returns `{ step: "mfa", mfa_token }` if 2FA is **on**

2. **Step 2 — TOTP (when enabled):** `POST /api/auth/verify-mfa` with `mfa_token` + 6-digit code  
   - Returns JWT access + refresh tokens

3. **Token refresh:** `POST /api/auth/refresh` with `refresh_token`

Enable 2FA under **Security** in the sidebar (Google Authenticator, Authy, etc.).

Set `JWT_SECRET` in production. Optional: `MFA_ISSUER` for authenticator app label.

### Social sign-in (Google / Microsoft)

The login screen offers **Continue with Google** and **Continue with Microsoft**. OAuth completes with the same JWT access + refresh tokens as password login.

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

## Notes for production

- Set `JWT_SECRET`, and optionally `PORT`, `DB_PATH`, `UPLOAD_DIR`, `MFA_ISSUER`.
- Require 2FA for super admin accounts in production.
- Change seeded demo passwords before deployment.
- Serve over HTTPS for PWA installability.
