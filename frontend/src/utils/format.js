export const ROLE_LABEL = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  operator: 'Operator',
  user: 'User',
};

export function fmtNum(n) {
  return Number(n).toLocaleString('en-US');
}

/** Display a serial with its (optional) letter prefix, e.g. "Z202415970". */
export function serialLabel(value, prefix) {
  return `${prefix || ''}${value ?? ''}`;
}

/**
 * Prints in a batch = barcode span × set size, e.g. (end - start) × sets.
 * Falls back to 1 print per barcode when no set size was recorded.
 */
export function batchPrints(batch) {
  const span = Number(batch.end_serial) - Number(batch.start_serial);
  if (!Number.isFinite(span)) return 0;
  return span * (Number(batch.set_count) || 1);
}

export function fmtDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function initials(name) {
  return (name || '?')
    .split(/\s|—/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
