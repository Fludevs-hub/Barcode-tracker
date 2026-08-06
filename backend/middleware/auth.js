'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const config = require('../config');
const UserModel = require('../models/UserModel');
const RefreshTokenModel = require('../models/RefreshTokenModel');

const ACCESS_EXPIRES_IN = '12h';
const MFA_PENDING_EXPIRES_IN = '5m';
const REFRESH_EXPIRES_IN = '7d';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = 'bt_refresh';

authenticator.options = { window: 1 };

function publicUser(user) {
  // A 'user'-role account with no assigned studies must complete study selection
  // (e.g. on first social sign-in) before it can use the app.
  const needsStudies = user.role === 'user' && UserModel.getStudyIds(user.id).length === 0;
  return {
    id: user.id,
    username: user.username,
    name: user.display_name,
    role: user.role,
    mfa_enabled: !!user.mfa_enabled,
    needs_studies: needsStudies,
  };
}

function signAccess(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.display_name, type: 'access' },
    config.jwtSecret,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

function signRefresh(user, jti) {
  return jwt.sign({ id: user.id, type: 'refresh', jti }, config.jwtSecret, { expiresIn: REFRESH_EXPIRES_IN });
}

function refreshCookieOptions() {
  // Scoped to /api/auth so the token is only ever sent to refresh/logout.
  return { httpOnly: true, sameSite: 'lax', secure: config.isProduction, path: '/api/auth', maxAge: REFRESH_TTL_MS };
}

// Mint a new refresh jti, record it, and set the httpOnly cookie.
function issueRefreshCookie(res, user) {
  RefreshTokenModel.purgeExpired();
  const jti = crypto.randomBytes(16).toString('hex');
  RefreshTokenModel.add(jti, user.id, Date.now() + REFRESH_TTL_MS);
  res.cookie(REFRESH_COOKIE, signRefresh(user, jti), refreshCookieOptions());
}

// Express sets cookies via res.cookie, but doesn't parse them — read it by hand.
function readRefreshCookie(req) {
  const raw = req.headers.cookie || '';
  const hit = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  return hit ? decodeURIComponent(hit.slice(REFRESH_COOKIE.length + 1)) : null;
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

// Verify the cookie, enforce the jti store, rotate (revoke old + issue new),
// and return the fresh user. Throws if anything is off.
function rotateRefresh(req, res) {
  const token = readRefreshCookie(req);
  if (!token) throw new Error('No refresh token.');
  const payload = verifyToken(token, 'refresh');
  if (!payload.jti || !RefreshTokenModel.isValid(payload.jti)) throw new Error('Refresh token is not valid.');
  const user = UserModel.findById(payload.id);
  if (!user) throw new Error('User not found.');
  RefreshTokenModel.revoke(payload.jti); // one-time use
  issueRefreshCookie(res, user);         // hand out the next one
  return user;
}

// Logout: revoke the current jti (best-effort) and drop the cookie.
function revokeRefreshCookie(req, res) {
  const token = readRefreshCookie(req);
  if (token) {
    try {
      const payload = verifyToken(token, 'refresh');
      if (payload.jti) RefreshTokenModel.revoke(payload.jti);
    } catch { /* already invalid — nothing to revoke */ }
  }
  clearRefreshCookie(res);
}

function signMfaPending(user) {
  return jwt.sign(
    { id: user.id, username: user.username, type: 'mfa_pending' },
    config.jwtSecret,
    { expiresIn: MFA_PENDING_EXPIRES_IN }
  );
}

function verifyToken(token, expectedType) {
  const payload = jwt.verify(token, config.jwtSecret);
  if (expectedType && payload.type !== expectedType) {
    throw new Error('Invalid token type.');
  }
  return payload;
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    req.user = verifyToken(token, 'access');
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this action.' });
    }
    next();
  };
}

function verifyTotp(secret, code) {
  if (!secret || !code) return false;
  return authenticator.check(String(code).replace(/\s/g, ''), secret);
}

function generateMfaSecret() {
  return authenticator.generateSecret();
}

function mfaKeyUri(username, secret) {
  const issuer = encodeURIComponent(config.mfaIssuer);
  const label = encodeURIComponent(username);
  return `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = {
  publicUser,
  signAccess,
  signMfaPending,
  verifyToken,
  authenticate,
  requireRole,
  verifyTotp,
  generateMfaSecret,
  mfaKeyUri,
  issueRefreshCookie,
  rotateRefresh,
  revokeRefreshCookie,
  clearRefreshCookie,
};
