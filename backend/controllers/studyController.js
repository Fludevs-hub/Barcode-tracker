'use strict';

const StudyModel = require('../models/StudyModel');
const { accessibleStudyIds } = require('../services/scopeService');

exports.list = (req, res) => {
  const allowed = accessibleStudyIds(req.user);
  let rows;
  if (allowed === null) rows = StudyModel.findAll();
  else if (allowed.length === 0) rows = [];
  else rows = StudyModel.findByIds(allowed);
  res.json({ studies: rows });
};

exports.create = (req, res) => {
  const { name, code } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Study name is required.' });
  try {
    const info = StudyModel.create(name, code);
    res.status(201).json({ study: StudyModel.findById(info.lastInsertRowid) });
  } catch {
    res.status(409).json({ error: 'A study with that name already exists.' });
  }
};

exports.update = (req, res) => {
  const id = Number(req.params.id);
  if (!StudyModel.findById(id)) return res.status(404).json({ error: 'Study not found.' });

  const { name, code } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Study name is required.' });
  try {
    StudyModel.update(id, name.trim(), (code || '').trim());
    res.json({ study: StudyModel.findById(id) });
  } catch {
    res.status(409).json({ error: 'A study with that name already exists.' });
  }
};
