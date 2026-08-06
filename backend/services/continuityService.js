'use strict';

function computeContinuity(batchesAsc) {
  const issues = [];
  for (let i = 1; i < batchesAsc.length; i++) {
    const prev = batchesAsc[i - 1];
    const cur = batchesAsc[i];
    if (cur.start_serial > prev.end_serial + 1) {
      issues.push({
        type: 'gap',
        after: prev.id,
        before: cur.id,
        from: prev.end_serial + 1,
        to: cur.start_serial - 1,
        size: cur.start_serial - prev.end_serial - 1,
      });
    } else if (cur.start_serial <= prev.end_serial) {
      issues.push({ type: 'overlap', after: prev.id, before: cur.id });
    }
  }
  const total = batchesAsc.reduce((s, b) => s + (b.end_serial - b.start_serial + 1), 0);
  return { issues, total };
}

module.exports = { computeContinuity };
