'use strict';

const BatchModel = require('../models/BatchModel');
const StudyModel = require('../models/StudyModel');
const { savePhoto } = require('../services/photoService');
const { computeContinuity } = require('../services/continuityService');
const { accessibleStudyIds, scopeClause } = require('../services/scopeService');
const { splitSerial } = require('../utils/serial');

exports.list = (req, res) => {
  const scope = scopeClause(req.user);
  if (scope.empty) return res.json({ batches: [] });

  const where = [];
  const params = [];
  if (scope.sql) { where.push(scope.sql); params.push(...scope.params); }
  if (req.query.study_id) { where.push('b.study_id = ?'); params.push(Number(req.query.study_id)); }
  if (req.query.q) {
    where.push('(b.start_code LIKE ? OR b.end_code LIKE ? OR b.printed_by LIKE ? OR s.name LIKE ?)');
    const like = `%${req.query.q}%`;
    params.push(like, like, like, like);
  }

  const batches = BatchModel.findAll(where.join(' AND '), params);
  res.json({ batches });
};

exports.getById = (req, res) => {
  const batch = BatchModel.findById(Number(req.params.id));
  if (!batch) return res.status(404).json({ error: 'Batch not found.' });

  const allowed = accessibleStudyIds(req.user);
  if (allowed !== null && !allowed.includes(batch.study_id)) {
    return res.status(403).json({ error: 'You do not have access to this batch.' });
  }
  res.json({ batch });
};

exports.create = (req, res) => {
  const b = req.body || {};
  for (const f of ['study_id', 'date_printed', 'start_serial', 'end_serial']) {
    if (b[f] === undefined || b[f] === null || b[f] === '') {
      return res.status(400).json({ error: `Missing field: ${f}.` });
    }
  }

  const studyId = Number(b.study_id);
  const startParsed = splitSerial(b.start_serial);
  const endParsed = splitSerial(b.end_serial);
  const start = startParsed.serial;
  const end = endParsed.serial;
  const serialPrefix = startParsed.prefix || endParsed.prefix || null;
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    return res.status(400).json({ error: 'End barcode must be a whole number not smaller than the start barcode.' });
  }
  if (!StudyModel.findById(studyId)) return res.status(400).json({ error: 'Unknown study.' });

  const allowed = accessibleStudyIds(req.user);
  if (allowed !== null && !allowed.includes(studyId)) {
    return res.status(403).json({ error: 'You can only record batches for studies assigned to you.' });
  }
  if (BatchModel.hasOverlap(start, end)) {
    return res.status(409).json({ error: 'That barcode range overlaps an existing batch. Adjust the start or end.', continuity: 'overlap' });
  }

  const maxEnd = BatchModel.maxEndSerial();
  let continuity = 'ok';
  if (maxEnd !== null) continuity = start === maxEnd + 1 ? 'ok' : start > maxEnd + 1 ? 'gap' : 'overlap';

  let startPhoto = null;
  let endPhoto = null;
  try {
    startPhoto = savePhoto(b.start_photo, 'start');
    endPhoto = savePhoto(b.end_photo, 'end');
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const info = BatchModel.create({
    studyId,
    datePrinted: b.date_printed,
    setCount: b.set_count ? Number(b.set_count) : null,
    startSerial: start,
    endSerial: end,
    serialPrefix,
    startCode: b.start_code || null,
    endCode: b.end_code || null,
    startPhoto,
    endPhoto,
    printedBy: b.printed_by || req.user.name,
    source: b.source === 'vendor' ? 'vendor' : 'internal',
    notes: b.notes || null,
    createdBy: req.user.id,
  });

  res.status(201).json({
    batch: BatchModel.findById(info.lastInsertRowid),
    continuity,
  });
};

exports.update = (req, res) => {
  const id = Number(req.params.id);
  const existing = BatchModel.findById(id);
  if (!existing) return res.status(404).json({ error: 'Batch not found.' });

  const b = req.body || {};
  for (const f of ['study_id', 'date_printed', 'start_serial', 'end_serial']) {
    if (b[f] === undefined || b[f] === null || b[f] === '') {
      return res.status(400).json({ error: `Missing field: ${f}.` });
    }
  }

  const studyId = Number(b.study_id);
  const startParsed = splitSerial(b.start_serial);
  const endParsed = splitSerial(b.end_serial);
  const start = startParsed.serial;
  const end = endParsed.serial;
  const serialPrefix = startParsed.prefix || endParsed.prefix || null;
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    return res.status(400).json({ error: 'End barcode must be a whole number not smaller than the start barcode.' });
  }
  if (!StudyModel.findById(studyId)) return res.status(400).json({ error: 'Unknown study.' });

  const allowed = accessibleStudyIds(req.user);
  if (allowed !== null && (!allowed.includes(studyId) || !allowed.includes(existing.study_id))) {
    return res.status(403).json({ error: 'You can only edit batches for studies assigned to you.' });
  }
  if (BatchModel.hasOverlap(start, end, id)) {
    return res.status(409).json({ error: 'That barcode range overlaps an existing batch. Adjust the start or end.', continuity: 'overlap' });
  }

  // Keep existing photos unless a new image (data URL) is supplied.
  let startPhoto = existing.start_photo;
  let endPhoto = existing.end_photo;
  try {
    const newStart = savePhoto(b.start_photo, 'start');
    const newEnd = savePhoto(b.end_photo, 'end');
    if (newStart) startPhoto = newStart;
    if (newEnd) endPhoto = newEnd;
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  BatchModel.update(id, {
    studyId,
    datePrinted: b.date_printed,
    setCount: b.set_count ? Number(b.set_count) : null,
    startSerial: start,
    endSerial: end,
    serialPrefix,
    startCode: b.start_code || null,
    endCode: b.end_code || null,
    startPhoto,
    endPhoto,
    printedBy: b.printed_by || existing.printed_by,
    source: b.source === 'vendor' ? 'vendor' : 'internal',
    notes: b.notes || null,
  });

  res.json({ batch: BatchModel.findById(id) });
};

exports.remove = (req, res) => {
  const id = Number(req.params.id);
  const existing = BatchModel.findById(id);
  if (!existing) return res.status(404).json({ error: 'Batch not found.' });

  const allowed = accessibleStudyIds(req.user);
  if (allowed !== null && !allowed.includes(existing.study_id)) {
    return res.status(403).json({ error: 'You can only delete batches for studies assigned to you.' });
  }

  BatchModel.remove(id);
  res.json({ ok: true });
};

exports.continuity = (req, res) => {
  const scope = scopeClause(req.user);
  if (scope.empty) return res.json({ segments: [], issues: [], total: 0 });

  const segments = BatchModel.findAll(scope.sql, scope.params, 'b.start_serial ASC');
  res.json({ segments, ...computeContinuity(segments) });
};
