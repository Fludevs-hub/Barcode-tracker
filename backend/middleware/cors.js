'use strict';

const config = require('../config');

const allowedOrigins = new Set([
  config.frontendUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);

// Reflecting any Origin is opt-in and explicit — never the default. Set
// CORS_ALLOW_ALL=1 only for local dev, never in a deployed environment.
const allowAllOrigins = process.env.CORS_ALLOW_ALL === '1';

function cors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.has(origin) || allowAllOrigins)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}

module.exports = cors;
