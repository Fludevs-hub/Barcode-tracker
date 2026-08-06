'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');

// Load .env from the project root (Node 20.6+ built-in, no dependency).
const ENV_PATH = path.join(ROOT, '.env');
if (fs.existsSync(ENV_PATH) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(ENV_PATH);
}

/**
 * Resolve the JWT secret. If none is provided via env, auto-generate a strong
 * one and persist it to .env so tokens stay valid across restarts.
 */
function resolveJwtSecret() {
  const existing = process.env.JWT_SECRET;
  if (existing && existing !== 'change-me-in-production' && existing !== 'dev-secret-change-me') {
    return existing;
  }

  const generated = crypto.randomBytes(64).toString('hex');
  try {
    let body = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
    if (/^JWT_SECRET=.*$/m.test(body)) {
      body = body.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${generated}`);
    } else {
      body += `${body.endsWith('\n') || body === '' ? '' : '\n'}JWT_SECRET=${generated}\n`;
    }
    fs.writeFileSync(ENV_PATH, body);
    console.log('Generated a new JWT_SECRET and saved it to .env');
  } catch (e) {
    console.warn('Generated an in-memory JWT_SECRET (could not write .env):', e.message);
  }
  process.env.JWT_SECRET = generated;
  return generated;
}

const port = Number(process.env.PORT || 3000);
const apiPublicUrl = process.env.API_PUBLIC_URL || `http://localhost:${port}`;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

module.exports = {
  root: ROOT,
  port,
  apiPublicUrl,
  frontendUrl,
  jwtSecret: resolveJwtSecret(),
  mfaIssuer: process.env.MFA_ISSUER || 'Barcode Tracker',
  dbPath: process.env.DB_PATH || path.join(ROOT, 'data', 'barcode.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(ROOT, 'uploads'),
  frontendDist: path.join(ROOT, 'frontend', 'dist'),
  isProduction: process.env.NODE_ENV === 'production',
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || `${apiPublicUrl}/api/auth/google/callback`,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${apiPublicUrl}/api/auth/microsoft/callback`,
    },
  },
};
