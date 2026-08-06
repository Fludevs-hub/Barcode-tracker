'use strict';

// Some studies (e.g. DTRA) print a single-letter prefix in front of the numeric
// "top barcode" serial — for example "Z202415970". The prefix is part of the
// physical label but must be stripped before the serial can be used for
// sequence / continuity / print math. splitSerial separates the two so we can
// keep the prefix for display while storing a clean integer for calculations.
function splitSerial(value) {
  if (value === undefined || value === null) return { prefix: '', serial: Number.NaN };
  const raw = String(value).trim().replace(/[\s,]/g, '');
  const m = raw.match(/^([A-Za-z]*)(\d+)$/);
  if (!m) return { prefix: '', serial: Number.NaN };
  return { prefix: m[1] || '', serial: Number(m[2]) };
}

// Convenience: the numeric serial only (NaN when not parseable).
function parseSerial(value) {
  return splitSerial(value).serial;
}

module.exports = { splitSerial, parseSerial };
