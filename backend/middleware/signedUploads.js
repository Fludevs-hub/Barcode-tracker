'use strict';

const crypto = require('crypto');
const config = require('../config');

// Upload URLs are only handed out by authenticated, study-scoped endpoints, and
// carry a short-lived HMAC so an <img> tag can load them without an auth header
// while an attacker who guesses a filename still gets a 403.
// ponytail: 1h TTL — long enough for a page view, short enough to matter. A
// reload re-fetches batch JSON with fresh signatures.
const TTL_MS = 60 * 60 * 1000;
const UPLOAD_RE = /^\/uploads\/([^?]+)$/;

function sign(file, exp) {
  return crypto.createHmac('sha256', config.jwtSecret).update(`${file}:${exp}`).digest('hex');
}

function signedPath(uploadPath) {
  const m = UPLOAD_RE.exec(uploadPath);
  if (!m) return uploadPath;
  const file = m[1];
  const exp = Date.now() + TTL_MS;
  return `/uploads/${file}?exp=${exp}&sig=${sign(file, exp)}`;
}

// Recursively rewrite any "/uploads/..." string in an outgoing JSON body into a
// signed URL. One choke point covers every endpoint that returns batch photos.
function signTree(value) {
  if (typeof value === 'string') return UPLOAD_RE.test(value) ? signedPath(value) : value;
  if (Array.isArray(value)) return value.map(signTree);
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = signTree(value[k]);
  }
  return value;
}

function signResponsePhotos(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => json(signTree(body));
  next();
}

function timingSafeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Gate the static /uploads route: require a valid, unexpired signature.
function verifyUpload(req, res, next) {
  const file = decodeURIComponent(req.path.replace(/^\/+/, ''));
  const exp = Number(req.query.exp);
  const sig = req.query.sig;
  if (!file || !Number.isFinite(exp) || exp < Date.now() || !sig) {
    return res.status(403).json({ error: 'Invalid or expired file link.' });
  }
  if (!timingSafeEqualHex(sig, sign(file, exp))) {
    return res.status(403).json({ error: 'Invalid or expired file link.' });
  }
  next();
}

module.exports = { signResponsePhotos, verifyUpload, signedPath };

if (require.main === module) {
  // self-check: a fresh signed path verifies; a tampered one is rejected.
  const p = signedPath('/uploads/start-1-abcd.png');
  const q = new URLSearchParams(p.split('?')[1]);
  const req = { path: '/start-1-abcd.png', query: { exp: q.get('exp'), sig: q.get('sig') } };
  let ok = false;
  verifyUpload(req, { status: () => ({ json: () => {} }) }, () => { ok = true; });
  const badReq = { path: '/start-1-abcd.png', query: { exp: q.get('exp'), sig: 'deadbeef' } };
  let blocked = true;
  verifyUpload(badReq, { status: () => ({ json: () => {} }) }, () => { blocked = false; });
  console.assert(ok && blocked, `expected valid pass + tampered block, got pass=${ok} block=${blocked}`);
  console.log('signedUploads self-check ok');
}
