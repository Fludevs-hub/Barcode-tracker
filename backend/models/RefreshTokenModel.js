'use strict';

const { db } = require('./database');

const RefreshTokenModel = {
  add(jti, userId, expiresAtMs) {
    db.prepare('INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES (?, ?, ?)')
      .run(jti, userId, expiresAtMs);
  },

  // Valid = present, not revoked, not expired.
  isValid(jti) {
    const row = db.prepare('SELECT expires_at, revoked FROM refresh_tokens WHERE jti = ?').get(jti);
    return !!row && !row.revoked && row.expires_at > Date.now();
  },

  revoke(jti) {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?').run(jti);
  },

  // ponytail: opportunistic cleanup on write path — no cron needed for this scale.
  purgeExpired() {
    db.prepare('DELETE FROM refresh_tokens WHERE expires_at <= ?').run(Date.now());
  },
};

module.exports = RefreshTokenModel;
