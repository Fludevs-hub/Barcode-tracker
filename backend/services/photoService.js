'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');

fs.mkdirSync(config.uploadDir, { recursive: true });

function savePhoto(dataUrl, prefix) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
  if (!m) return null;
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) throw new Error('Photo is too large (max 8 MB).');
  const name = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(config.uploadDir, name), buf);
  return `/uploads/${name}`;
}

module.exports = { savePhoto };
