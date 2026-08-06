import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PageHead from '../components/PageHead';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { StudyPill } from '../components/SequenceRibbon';
import { batchPrints, fmtDate, fmtNum, serialLabel } from '../utils/format';
import { classifyBarcodeScans, compressImage, detectBarcodes } from '../utils/image';
import { primeStudyColors } from '../utils/studyColors';

function PhotoField({ label, value, onChange, onScan, onClear }) {
  const [status, setStatus] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('');
    let dataUrl = null;
    try {
      dataUrl = await compressImage(file);
    } catch {
      onChange(null);
      return;
    }
    onChange(dataUrl);

    if (onScan) {
      setStatus('Scanning barcodes…');
      // Scan a higher-resolution render so small/angled barcodes still decode.
      let scanUrl = dataUrl;
      try { scanUrl = await compressImage(file, 1920, 0.92); } catch { /* fall back to preview */ }
      const scans = await detectBarcodes(scanUrl);
      const { serial, code } = classifyBarcodeScans(scans);
      console.log(`[barcode] ${label} OCR`, { serial, code, rawScans: scans.map((s) => s.rawValue) });
      if (serial || code) {
        onScan({ serial, code });
        setStatus(serial && code
          ? 'Barcodes detected — review the fields above.'
          : 'Only one barcode detected — fill the rest manually.');
      } else {
        setStatus('No barcode detected — enter the values manually.');
      }
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label} barcode photo (optional)</label>
      <div
        className="mb-2 grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border border-dashed text-sm text-[var(--faint)]"
        style={{ borderColor: 'var(--line)', background: 'var(--line-2)' }}
      >
        {value ? <img src={value} alt={`${label} preview`} className="h-full w-full object-cover" /> : 'No photo'}
      </div>
      <div className="flex gap-2">
        <label className="btn cursor-pointer">
          Take / choose
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        </label>
        {value && <button type="button" className="btn" onClick={() => { onChange(null); setStatus(''); onClear?.(); }}>Remove</button>}
      </div>
      {status && <p className="mt-1.5 text-xs text-[var(--faint)]">{status}</p>}
    </div>
  );
}

function makeInitialForm(studies, user, editing) {
  if (editing) {
    return {
      study_id: editing.study_id || '',
      date_printed: (editing.date_printed || '').slice(0, 10),
      set_count: editing.set_count ?? '',
      start_serial: serialLabel(editing.start_serial, editing.serial_prefix),
      end_serial: serialLabel(editing.end_serial, editing.serial_prefix),
      start_code: editing.start_code || '',
      end_code: editing.end_code || '',
      printed_by: editing.printed_by || '',
      source: editing.source || 'internal',
      notes: editing.notes || '',
    };
  }
  return {
    study_id: studies[0]?.id || '',
    date_printed: new Date().toISOString().slice(0, 10),
    set_count: '',
    start_serial: '',
    end_serial: '',
    start_code: '',
    end_code: '',
    printed_by: user.name,
    source: 'internal',
    notes: '',
  };
}

function BatchFormModal({ studies, user, open, editing, onClose, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => makeInitialForm(studies, user, editing));
  const [photos, setPhotos] = useState({ start: null, end: null });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(makeInitialForm(studies, user, editing));
    setPhotos({ start: editing?.start_photo || null, end: editing?.end_photo || null });
    setError('');
  }, [open, editing, studies, user]);

  const save = async () => {
    const clean = (v) => (v || '').replace(/[^0-9A-Za-z]/g, '');
    const startSerial = clean(form.start_serial);
    const endSerial = clean(form.end_serial);
    const startCode = clean(form.start_code);
    const endCode = clean(form.end_code);
    if (startSerial.length !== 10 || endSerial.length !== 10) {
      setError('Top serials must be exactly 10 characters.');
      return;
    }
    if (startCode.length !== 9 || endCode.length !== 9) {
      setError('Bottom codes must be exactly 9 characters.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const isData = (v) => typeof v === 'string' && v.startsWith('data:');
      const payload = {
        ...form,
        start_serial: startSerial,
        end_serial: endSerial,
        start_code: startCode,
        end_code: endCode,
        set_count: form.set_count || null,
        start_photo: isData(photos.start) ? photos.start : null,
        end_photo: isData(photos.end) ? photos.end : null,
      };
      console.log('[barcode] form model before save', {
        start_serial: form.start_serial, start_code: form.start_code,
        end_serial: form.end_serial, end_code: form.end_code,
      });
      console.log('[barcode] payload before submit', {
        start_serial: payload.start_serial, start_code: payload.start_code,
        end_serial: payload.end_serial, end_code: payload.end_code,
      });
      const res = await api(editing ? `/api/batches/${editing.id}` : '/api/batches', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      onClose();
      if (editing) {
        showToast('Batch updated.', 'ok');
      } else {
        showToast(res.continuity === 'gap' ? 'Batch saved — note it leaves a gap.' : 'Batch saved.', res.continuity === 'gap' ? 'warn' : 'ok');
      }
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const title = editing ? 'Edit barcode batch' : 'Record a barcode batch';

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{title}</h3>
      {error && <div className="banner banner-error mt-4">{error}</div>}
      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Study</label>
          <select className="input" value={form.study_id} onChange={(e) => setForm({ ...form, study_id: e.target.value })}>
            {studies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1.5 block text-sm font-medium">Date printed</label><input className="input" type="date" value={form.date_printed} onChange={(e) => setForm({ ...form, date_printed: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Sets (optional)</label><input className="input" type="number" min="0" value={form.set_count} onChange={(e) => setForm({ ...form, set_count: e.target.value })} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Start barcode</label>
            <div>
              <span className="mb-1 block text-xs text-[var(--faint)]">Top serial — 10 characters (e.g. 2025041198)</span>
              <input className="input mono" placeholder="2025041198" maxLength={10} value={form.start_serial} onChange={(e) => setForm({ ...form, start_serial: e.target.value })} />
            </div>
            <div>
              <span className="mb-1 block text-xs text-[var(--faint)]">Bottom code — 9 characters (e.g. KH25BCEPW)</span>
              <input className="input mono" placeholder="KH25BCEPW" maxLength={9} value={form.start_code} onChange={(e) => setForm({ ...form, start_code: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">End barcode</label>
            <div>
              <span className="mb-1 block text-xs text-[var(--faint)]">Top serial — 10 characters (e.g. 2025041863)</span>
              <input className="input mono" placeholder="2025041863" maxLength={10} value={form.end_serial} onChange={(e) => setForm({ ...form, end_serial: e.target.value })} />
            </div>
            <div>
              <span className="mb-1 block text-xs text-[var(--faint)]">Bottom code — 9 characters (e.g. KH25BCTKB)</span>
              <input className="input mono" placeholder="KH25BCTKB" maxLength={9} value={form.end_code} onChange={(e) => setForm({ ...form, end_code: e.target.value })} />
            </div>
          </div>
        </div>
        <p className="-mt-2 text-xs text-[var(--faint)]">A single-letter prefix (e.g. DTRA&rsquo;s &ldquo;Z&rdquo;) on the top serial is ignored when calculating the sequence.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <PhotoField
            label="Start"
            value={photos.start}
            onChange={(v) => setPhotos((p) => ({ ...p, start: v }))}
            onClear={() => setForm((f) => ({ ...f, start_serial: '', start_code: '' }))}
            onScan={({ serial, code }) => {
              setError('');
              setForm((f) => ({
                ...f,
                ...(serial ? { start_serial: serial } : {}),
                ...(code ? { start_code: code } : {}),
              }));
            }}
          />
          <PhotoField
            label="End"
            value={photos.end}
            onChange={(v) => setPhotos((p) => ({ ...p, end: v }))}
            onClear={() => setForm((f) => ({ ...f, end_serial: '', end_code: '' }))}
            onScan={({ serial, code }) => {
              setError('');
              setForm((f) => ({
                ...f,
                ...(serial ? { end_serial: serial } : {}),
                ...(code ? { end_code: code } : {}),
              }));
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1.5 block text-sm font-medium">Signed by</label><input className="input" value={form.printed_by} onChange={(e) => setForm({ ...form, printed_by: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Source</label><select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}><option value="internal">Internal</option><option value="vendor">Vendor</option></select></div>
        </div>
        <div><label className="mb-1.5 block text-sm font-medium">Notes (optional)</label><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : (editing ? 'Save changes' : 'Save batch')}</button>
      </div>
    </Modal>
  );
}

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

// Native date inputs give us before / after / on / between for free: leave a
// side empty for open-ended. Presets cover the common Metabase-style ranges.
function DateFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const now = new Date();
  const presets = [
    ['All dates', { from: '', to: '' }],
    ['Today', { from: iso(now), to: iso(now) }],
    ['Last 7 days', { from: daysAgo(6), to: iso(now) }],
    ['Last 30 days', { from: daysAgo(29), to: iso(now) }],
    ['This month', { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: iso(now) }],
    ['This year', { from: `${now.getFullYear()}-01-01`, to: iso(now) }],
  ];
  const label = value.from || value.to ? `${value.from || '…'} → ${value.to || '…'}` : 'All dates';

  return (
    <div className="relative sm:max-w-[220px]" ref={ref}>
      <button type="button" className="input w-full text-left" onClick={() => setOpen((o) => !o)}>{label}</button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-lg border p-3 shadow-lg" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <div className="grid grid-cols-2 gap-1.5">
            {presets.map(([name, range]) => (
              <button key={name} type="button" className="btn px-2 py-1.5 text-xs" onClick={() => { onChange(range); setOpen(false); }}>{name}</button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <label className="block text-xs text-[var(--faint)]">From<input type="date" className="input mt-1" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} /></label>
            <label className="block text-xs text-[var(--faint)]">To<input type="date" className="input mt-1" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} /></label>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BatchesPage() {
  const { user, isAdminOrAbove } = useAuth();
  const { showToast } = useToast();
  const [studies, setStudies] = useState([]);
  const [batches, setBatches] = useState([]);
  const [q, setQ] = useState('');
  const [studyId, setStudyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [sort, setSort] = useState({ key: 'range', dir: 'desc' });

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  const sortArrow = (key) => (sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '');

  const visible = useMemo(() => {
    let rows = batches;
    if (dateRange.from) rows = rows.filter((b) => (b.date_printed || '').slice(0, 10) >= dateRange.from);
    if (dateRange.to) rows = rows.filter((b) => (b.date_printed || '').slice(0, 10) <= dateRange.to);
    const val = sort.key === 'date' ? (b) => b.date_printed || '' : (b) => b.start_serial;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * dir);
  }, [batches, dateRange, sort]);

  const openCreate = () => {
    if (!studies.length) { showToast('No studies are assigned to you yet.', 'warn'); return; }
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (batch) => {
    setEditing(batch);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/batches/${deleting.id}`, { method: 'DELETE' });
      showToast('Batch deleted.', 'ok');
      setDeleting(null);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ studies: s }, batchRes] = await Promise.all([
        api('/api/studies'),
        api(`/api/batches?${new URLSearchParams({ ...(q && { q }), ...(studyId && { study_id: studyId }) })}`),
      ]);
      primeStudyColors(s);
      setStudies(s);
      setBatches(batchRes.batches);
    } finally {
      setLoading(false);
    }
  }, [q, studyId]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHead eyebrow="Batches" title="Barcode batches" subtitle="Every recorded range, newest first" />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input className="input sm:max-w-xs sm:flex-1" placeholder="Search code, study or signature…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input sm:max-w-[220px]" value={studyId} onChange={(e) => setStudyId(e.target.value)}>
          <option value="">All studies</option>
          {studies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <DateFilter value={dateRange} onChange={setDateRange} />
        <div className="hidden sm:block sm:flex-1" />
        <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={openCreate}>Record batch</button>
      </div>

      {loading ? (
        <div className="text-[var(--muted)]">Loading…</div>
      ) : !visible.length ? (
        <div className="card text-center text-[var(--muted)]">No batches found</div>
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-[var(--muted)]" style={{ borderColor: 'var(--line)' }}>
                <th className="px-4 py-3"><button type="button" className="uppercase tracking-wide hover:text-[var(--ink)]" onClick={() => toggleSort('date')}>Date{sortArrow('date')}</button></th><th className="px-4 py-3">Study</th><th className="px-4 py-3"><button type="button" className="uppercase tracking-wide hover:text-[var(--ink)]" onClick={() => toggleSort('range')}>Range{sortArrow('range')}</button></th><th className="px-4 py-3">Codes</th><th className="px-4 py-3">Sets</th><th className="px-4 py-3">Signed</th><th className="px-4 py-3">Source</th>
                {isAdminOrAbove && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <tr key={b.id} className="border-b align-top" style={{ borderColor: 'var(--line-2)' }}>
                  <td className="px-4 py-3">{fmtDate(b.date_printed)}</td>
                  <td className="px-4 py-3"><StudyPill name={b.study_name} />{b.notes && <div className="mono mt-1 text-xs text-[var(--muted)]">{b.notes}</div>}</td>
                  <td className="mono px-4 py-3">{serialLabel(b.start_serial, b.serial_prefix)}<br />{serialLabel(b.end_serial, b.serial_prefix)}<div className="text-xs text-[var(--muted)]">{fmtNum(batchPrints(b))} prints</div></td>
                  <td className="mono px-4 py-3 text-xs text-[var(--muted)]">{b.start_code || '—'}<br />{b.end_code || '—'}</td>
                  <td className="px-4 py-3">{b.set_count ?? '—'}</td>
                  <td className="px-4 py-3">{b.printed_by || '—'}</td>
                  <td className="px-4 py-3"><span className={`pill ${b.source === 'vendor' ? 'pill-danger' : 'pill-internal'}`}>{b.source}</span></td>
                  {isAdminOrAbove && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn px-3 py-1.5" onClick={() => openEdit(b)}>Edit</button>
                        <button type="button" className="btn btn-danger px-3 py-1.5" onClick={() => setDeleting(b)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BatchFormModal studies={studies} user={user} open={showForm} editing={editing} onClose={closeForm} onSaved={load} />

      <Modal open={!!deleting} onClose={() => !deleteBusy && setDeleting(null)} title="Delete barcode batch">
        <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Delete barcode batch</h3>
        {deleting && (
          <div className="banner banner-error mt-4">
            This will permanently delete batch{' '}
            <span className="mono">{serialLabel(deleting.start_serial, deleting.serial_prefix)} – {serialLabel(deleting.end_serial, deleting.serial_prefix)}</span>
            {' '}for {deleting.study_name}. This cannot be undone.
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</button>
          <button type="button" className="btn btn-danger" disabled={deleteBusy} onClick={confirmDelete}>{deleteBusy ? 'Deleting…' : 'Delete batch'}</button>
        </div>
      </Modal>
    </>
  );
}
