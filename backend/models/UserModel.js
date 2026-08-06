'use strict';

const bcrypt = require('bcryptjs');
const { db } = require('./database');

const UserModel = {
  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByEmail(email) {
    if (!email) return null;
    return db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email);
  },

  findByOAuth(provider, sub) {
    return db.prepare('SELECT * FROM users WHERE oauth_provider = ? AND oauth_sub = ?').get(provider, sub);
  },

  linkOAuth(id, { provider, sub, email }) {
    db.prepare('UPDATE users SET oauth_provider = ?, oauth_sub = ?, email = COALESCE(email, ?) WHERE id = ?')
      .run(provider, sub, email, id);
  },

  verifyPassword(user, password) {
    return bcrypt.compareSync(password, user.password_hash);
  },

  hashPassword(password) {
    return bcrypt.hashSync(password, 10);
  },

  getStudyIds(userId) {
    return db.prepare('SELECT study_id FROM user_studies WHERE user_id = ?').all(userId).map((r) => r.study_id);
  },

  listForAdmin() {
    const users = db.prepare(`
      SELECT id, username, display_name, role, email, mfa_enabled, created_at FROM users
      ORDER BY (role='super_admin') DESC, (role='admin') DESC, (role='operator') DESC, username
    `).all();
    for (const u of users) {
      u.studies = UserModel.getStudyIds(u.id);
      u.mfa_enabled = !!u.mfa_enabled;
    }
    return users;
  },

  create({ username, passwordHash, displayName, role, email = null }) {
    return db.prepare('INSERT INTO users (username, password_hash, display_name, role, email) VALUES (?, ?, ?, ?, ?)')
      .run(username, passwordHash, displayName, role, email);
  },

  updateRole(id, role) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  },

  updateProfile(id, { displayName, email }) {
    db.prepare('UPDATE users SET display_name = ?, email = ? WHERE id = ?').run(displayName, email, id);
  },

  updatePassword(id, passwordHash) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  },

  clearStudyLinks(userId) {
    db.prepare('DELETE FROM user_studies WHERE user_id = ?').run(userId);
  },

  setStudyLinks(userId, studyIds) {
    UserModel.clearStudyLinks(userId);
    const link = db.prepare('INSERT OR IGNORE INTO user_studies (user_id, study_id) VALUES (?, ?)');
    for (const sid of studyIds) link.run(userId, Number(sid));
  },

  countByRole(role) {
    return db.prepare('SELECT COUNT(*) AS n FROM users WHERE role = ?').get(role).n;
  },

  setMfaSecret(id, secret) {
    db.prepare('UPDATE users SET mfa_secret = ?, mfa_enabled = 0 WHERE id = ?').run(secret, id);
  },

  enableMfa(id) {
    db.prepare('UPDATE users SET mfa_enabled = 1 WHERE id = ?').run(id);
  },

  disableMfa(id) {
    db.prepare('UPDATE users SET mfa_enabled = 0, mfa_secret = NULL WHERE id = ?').run(id);
  },

  uniqueUsername(base) {
    let candidate = String(base).replace(/[^a-z0-9._-]/gi, '').toLowerCase() || 'user';
    if (candidate.length > 32) candidate = candidate.slice(0, 32);
    if (!UserModel.findByUsername(candidate)) return candidate;
    for (let i = 2; i < 1000; i += 1) {
      const suffix = String(i);
      const trimmed = candidate.slice(0, Math.max(1, 32 - suffix.length));
      const next = `${trimmed}${suffix}`;
      if (!UserModel.findByUsername(next)) return next;
    }
    throw new Error('Could not generate a unique username.');
  },
};

module.exports = UserModel;
