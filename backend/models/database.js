'use strict';

const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { ROLES } = require('../utils/permissions');
const { splitSerial } = require('../utils/serial');

const DB_PATH = config.dbPath;
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const ROLE_CHECK = ROLES.map((r) => `'${r}'`).join(',');

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name  TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN (${ROLE_CHECK})),
      mfa_secret    TEXT,
      mfa_enabled   INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS studies (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      code       TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_studies (
      user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, study_id)
    );

    CREATE TABLE IF NOT EXISTS batches (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      study_id     INTEGER NOT NULL REFERENCES studies(id),
      date_printed TEXT NOT NULL,
      set_count    INTEGER,
      start_serial INTEGER NOT NULL,
      end_serial   INTEGER NOT NULL,
      start_code   TEXT,
      end_code     TEXT,
      start_photo  TEXT,
      end_photo    TEXT,
      printed_by   TEXT,
      source       TEXT NOT NULL DEFAULT 'internal' CHECK (source IN ('internal','vendor')),
      notes        TEXT,
      created_by   INTEGER REFERENCES users(id),
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_batches_start ON batches(start_serial);
    CREATE INDEX IF NOT EXISTS idx_batches_study ON batches(study_id);
    CREATE INDEX IF NOT EXISTS idx_batches_date  ON batches(date_printed);

    -- One row per issued refresh token (by jti) so tokens can be rotated and revoked.
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      jti        TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      revoked    INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function migrate() {
  const cols = db.prepare('PRAGMA table_info(batches)').all().map((c) => c.name);
  if (!cols.includes('start_photo')) db.exec('ALTER TABLE batches ADD COLUMN start_photo TEXT;');
  if (!cols.includes('end_photo')) db.exec('ALTER TABLE batches ADD COLUMN end_photo TEXT;');
  if (!cols.includes('serial_prefix')) db.exec('ALTER TABLE batches ADD COLUMN serial_prefix TEXT;');

  // Repair any batch whose serials were stored with a letter prefix (TEXT) so the
  // numeric value can be used for sequence math; the prefix is kept separately.
  const serialRows = db.prepare('SELECT id, start_serial, end_serial, serial_prefix FROM batches').all();
  const fixSerial = db.prepare('UPDATE batches SET start_serial = ?, end_serial = ?, serial_prefix = ? WHERE id = ?');
  for (const r of serialRows) {
    const s = splitSerial(r.start_serial);
    const e = splitSerial(r.end_serial);
    if (!Number.isInteger(s.serial) || !Number.isInteger(e.serial)) continue;
    const prefix = r.serial_prefix || s.prefix || e.prefix || null;
    const needsFix = typeof r.start_serial !== 'number'
      || typeof r.end_serial !== 'number'
      || (prefix && !r.serial_prefix);
    if (needsFix) fixSerial.run(s.serial, e.serial, prefix, r.id);
  }

  const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!userCols.includes('mfa_secret')) db.exec('ALTER TABLE users ADD COLUMN mfa_secret TEXT;');
  if (!userCols.includes('mfa_enabled')) db.exec('ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0;');
  if (!userCols.includes('email')) db.exec('ALTER TABLE users ADD COLUMN email TEXT;');
  if (!userCols.includes('oauth_provider')) db.exec('ALTER TABLE users ADD COLUMN oauth_provider TEXT;');
  if (!userCols.includes('oauth_sub')) db.exec('ALTER TABLE users ADD COLUMN oauth_sub TEXT;');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;');

  const usersSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() || {}).sql || '';
  const stale = !usersSql.includes("'super_admin'") || usersSql.includes('coordinator') || usersSql.includes('viewer');
  if (stale) {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('BEGIN;');
    db.exec(`
      CREATE TABLE users_new (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name  TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN (${ROLE_CHECK})),
        mfa_secret    TEXT,
        mfa_enabled   INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users_new (id, username, password_hash, display_name, role, mfa_secret, mfa_enabled, created_at)
        SELECT id, username, password_hash, display_name,
               CASE role
                 WHEN 'super_admin' THEN 'super_admin'
                 WHEN 'admin'       THEN 'admin'
                 WHEN 'operator'    THEN 'operator'
                 ELSE 'user'
               END,
               mfa_secret, COALESCE(mfa_enabled, 0), created_at
        FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
    db.exec('COMMIT;');
    db.exec('PRAGMA foreign_keys = ON;');
    console.log('Migrated users to super_admin/admin/operator/user roles.');
  }

  if (!db.prepare("SELECT 1 FROM users WHERE role='super_admin'").get()) {
    const firstAdmin = db.prepare("SELECT id FROM users WHERE role='admin' ORDER BY id ASC LIMIT 1").get();
    if (firstAdmin) {
      db.prepare("UPDATE users SET role='super_admin' WHERE id=?").run(firstAdmin.id);
      console.log('Promoted first admin to super_admin.');
    }
  }
}

function seedIfEmpty() {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return;

  const insertUser = db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)');
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // Default (safe) bootstrap: one super admin with a random password printed
  // once to the console. The weak, publicly-known demo accounts and sample
  // ledger only load when SEED_DEMO=1 is set explicitly (local dev only).
  if (process.env.SEED_DEMO !== '1') {
    const pw = crypto.randomBytes(12).toString('base64url');
    insertUser.run('superadmin', hash(pw), 'Super Admin', 'super_admin');
    console.log('\n=== Barcode Tracker: first-run admin created ===');
    console.log('  username: superadmin');
    console.log(`  password: ${pw}`);
    console.log('  Change this password after signing in. Shown once.\n');
    return;
  }

  const superId = insertUser.run('superadmin', hash('super123'), 'Sam — Super Admin', 'super_admin').lastInsertRowid;
  insertUser.run('admin', hash('admin123'), 'Ada — Admin', 'admin');
  insertUser.run('operator', hash('operator123'), 'Otis — Operator', 'operator');
  const userId = insertUser.run('user', hash('user123'), 'Uma — User', 'user').lastInsertRowid;

  const insertStudy = db.prepare('INSERT INTO studies (name, code) VALUES (?, ?)');
  const studyId = {};
  for (const [name, code] of [
    ['FLU RSV IMPACT', 'FRI'], ['LSS', 'LSS'], ['Annual Flu', 'AFLU'],
    ['Sensorflu', 'SFLU'], ['ICAP', 'ICAP'],
  ]) studyId[name] = insertStudy.run(name, code).lastInsertRowid;

  const link = db.prepare('INSERT INTO user_studies (user_id, study_id) VALUES (?, ?)');
  link.run(userId, studyId['FLU RSV IMPACT']);
  link.run(userId, studyId['Sensorflu']);

  const insertBatch = db.prepare(`
    INSERT INTO batches
      (study_id, date_printed, set_count, start_serial, end_serial,
       start_code, end_code, printed_by, source, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const rows = [
    ['FLU RSV IMPACT', '2026-04-20', 10, 2026009330, 2026010279, 'KH26AFRWV', 'KH26AGFXV', 'A.O', 'internal', null],
    ['LSS', '2026-04-24', 10, 2026010280, 2026011197, 'KH26AGFXW', 'KH26AGTMX', 'OBO', 'internal', null],
    ['Annual Flu', '2026-05-08', 16, 2026011198, 2026012205, 'KH26AGTMY', 'KH26AHIKP', 'Jasim', 'internal', null],
    ['Annual Flu', '2026-05-08', null, 2026012206, 2026012770, 'KH26AHIRQ', 'KH26AHQTX', 'Jasim', 'internal', 'Continuation of 08/05 run'],
    ['FLU RSV IMPACT', '2026-05-12', 20, 2026012771, 2026012929, 'KH26AHQTY', 'KH26AHVLM', 'A.O', 'internal', 'Placental tissue'],
    ['Sensorflu', '2026-05-14', null, 2026012930, 2026013591, 'KH26AHVLN', 'KH26AIKDK', 'OBO', 'internal', 'Site: Kwak'],
    ['Sensorflu', '2026-05-14', null, 2026013592, 2026014270, 'KH26AIKDL', 'KH26AIZFD', 'OBO', 'internal', 'Site: Singya'],
    ['ICAP', '2026-06-25', 40, 2026014271, 2026018300, 'KC26AAAAA', 'KC26', 'NOEC Akumba', 'vendor', 'Printed by vendor — 4 rolls of 10s'],
  ];
  for (const r of rows) insertBatch.run(studyId[r[0]], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], superId);

  console.log('Database seeded with demo users and ledger data.');
}

createTables();
migrate();
seedIfEmpty();

module.exports = { db, ROLES };
