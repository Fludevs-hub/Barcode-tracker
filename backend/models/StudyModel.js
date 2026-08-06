'use strict';

const { db } = require('./database');

const StudyModel = {
  findAll() {
    return db.prepare('SELECT * FROM studies ORDER BY name').all();
  },

  /** Sign-up picker: id + name from the studies table only. */
  listNamesForSignup() {
    return db.prepare('SELECT id, name FROM studies ORDER BY name COLLATE NOCASE ASC').all();
  },

  findByIds(ids) {
    if (!ids.length) return [];
    return db.prepare(`SELECT * FROM studies WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY name`).all(...ids);
  },

  findById(id) {
    return db.prepare('SELECT * FROM studies WHERE id = ?').get(id);
  },

  create(name, code) {
    return db.prepare('INSERT INTO studies (name, code) VALUES (?, ?)').run(name, code || null);
  },

  update(id, name, code) {
    return db.prepare('UPDATE studies SET name = ?, code = ? WHERE id = ?').run(name, code || null, id);
  },
};

module.exports = StudyModel;
