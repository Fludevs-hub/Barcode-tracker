'use strict';

const BatchModel = require('../models/BatchModel');
const StudyModel = require('../models/StudyModel');
const { computeContinuity } = require('../services/continuityService');
const { accessibleStudyIds, scopeClause } = require('../services/scopeService');

exports.get = (req, res) => {
  const allowed = accessibleStudyIds(req.user);
  const scope = scopeClause(req.user);

  let studies;
  if (allowed === null) studies = StudyModel.findAll();
  else if (allowed.length === 0) studies = [];
  else studies = StudyModel.findByIds(allowed);

  if (scope.empty) {
    return res.json({ segments: [], issues: [], total: 0, lastOverall: null, lastByStudy: [], recent: [], studies: [] });
  }

  // One DB read; derive the date-desc order in JS (date_printed is 'YYYY-MM-DD',
  // so a string compare is chronological). Saves a second identical query.
  const bySerialAsc = BatchModel.findAll(scope.sql, scope.params, 'b.start_serial ASC');
  const byDateDesc = [...bySerialAsc].sort(
    (a, b) => b.date_printed.localeCompare(a.date_printed) || b.id - a.id
  );

  const seen = new Set();
  const lastByStudyMap = {};
  for (const b of byDateDesc) {
    if (!seen.has(b.study_id)) {
      seen.add(b.study_id);
      lastByStudyMap[b.study_id] = b;
    }
  }
  const lastByStudy = studies.map((s) => ({ study: s, batch: lastByStudyMap[s.id] || null }));

  res.json({
    segments: bySerialAsc,
    ...computeContinuity(bySerialAsc),
    lastOverall: byDateDesc[0] || null,
    lastByStudy,
    recent: byDateDesc.slice(0, 12),
    studies,
  });
};
