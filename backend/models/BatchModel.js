'use strict';

const { db } = require('./database');

const SELECT_BATCH = `SELECT b.*, s.name AS study_name, s.code AS study_code
                      FROM batches b JOIN studies s ON s.id = b.study_id`;

const BatchModel = {
  SELECT_BATCH,

  findAll(whereSql, params, orderBy = 'b.start_serial DESC') {
    const sql = SELECT_BATCH + (whereSql ? ` WHERE ${whereSql}` : '') + ` ORDER BY ${orderBy}`;
    return db.prepare(sql).all(...params);
  },

  findById(id) {
    return db.prepare(SELECT_BATCH + ' WHERE b.id = ?').get(id);
  },

  hasOverlap(start, end, excludeId = null) {
    if (excludeId) {
      return db.prepare('SELECT id FROM batches WHERE start_serial <= ? AND end_serial >= ? AND id != ?')
        .get(end, start, excludeId);
    }
    return db.prepare('SELECT id FROM batches WHERE start_serial <= ? AND end_serial >= ?').get(end, start);
  },

  maxEndSerial() {
    return db.prepare('SELECT MAX(end_serial) AS m FROM batches').get().m;
  },

  create(fields) {
    return db.prepare(`
      INSERT INTO batches (study_id, date_printed, set_count, start_serial, end_serial, serial_prefix,
        start_code, end_code, start_photo, end_photo, printed_by, source, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fields.studyId, fields.datePrinted, fields.setCount, fields.startSerial, fields.endSerial, fields.serialPrefix,
      fields.startCode, fields.endCode, fields.startPhoto, fields.endPhoto,
      fields.printedBy, fields.source, fields.notes, fields.createdBy
    );
  },

  update(id, fields) {
    return db.prepare(`
      UPDATE batches SET
        study_id = ?, date_printed = ?, set_count = ?, start_serial = ?, end_serial = ?, serial_prefix = ?,
        start_code = ?, end_code = ?, start_photo = ?, end_photo = ?,
        printed_by = ?, source = ?, notes = ?
      WHERE id = ?
    `).run(
      fields.studyId, fields.datePrinted, fields.setCount, fields.startSerial, fields.endSerial, fields.serialPrefix,
      fields.startCode, fields.endCode, fields.startPhoto, fields.endPhoto,
      fields.printedBy, fields.source, fields.notes, id
    );
  },

  remove(id) {
    return db.prepare('DELETE FROM batches WHERE id = ?').run(id);
  },
};

module.exports = BatchModel;
