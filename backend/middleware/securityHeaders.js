'use strict';

const config = require('../config');

// ponytail: helmet's protection without the dependency. These are the same
// headers helmet sets by default, minus the no-op ones, hand-set in ~15 lines.
// CSP is tuned for a Vite SPA (same-origin hashed JS/CSS, inline styles, data:
// images). CORP is 'cross-origin' so the dev frontend on :5173 can still embed
// /uploads images served by the API on :3000 — tighten to same-origin once the
// SPA and API share an origin. If a bundle fails to load, relax the offending
// CSP directive rather than dropping the header.
const CSP =
  "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-XSS-Protection', '0'); // disable the legacy, buggy auditor
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

module.exports = securityHeaders;
