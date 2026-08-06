import { useEffect, useState } from 'react';
import { api } from '../api/client';
import PageHead from '../components/PageHead';
import Modal from '../components/Modal';
import SequenceRibbon, { ContinuityNote, StudyPill } from '../components/SequenceRibbon';
import { fmtDate, fmtNum, serialLabel } from '../utils/format';
import { primeStudyColors } from '../utils/studyColors';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api('/api/dashboard')
      .then((d) => {
        primeStudyColors(d.studies);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="banner banner-error">{error}</div>;
  if (!data) return <div className="text-[var(--muted)]">Loading…</div>;

  if (!data.segments.length) {
    return (
      <>
        <PageHead eyebrow="Monitor" title="Dashboard" subtitle="Latest prints and sequence health" />
        <div className="card text-center text-[var(--muted)]">
          <div className="font-semibold text-[var(--ink)]">No prints to show yet</div>
          <div className="mt-1">Record the first barcode batch from the Batches tab.</div>
        </div>
      </>
    );
  }

  const minStart = data.segments[0].start_serial;
  const maxEnd = data.segments[data.segments.length - 1].end_serial;
  const gaps = data.issues.filter((i) => i.type === 'gap');
  const overlaps = data.issues.filter((i) => i.type === 'overlap');
  const lo = data.lastOverall;

  // A barcode roll holds 10,000 prints. Prints per batch = serial span × set count.
  // A partial roll that reaches 9,000 prints is rounded up to a full roll.
  const ROLL_CAPACITY = 10000;
  const ROLL_ROUND_UP = 9000;
  const totalPrints = data.segments.reduce(
    (sum, b) => sum + (b.end_serial - b.start_serial) * (b.set_count || 1),
    0,
  );
  const rolls = Math.floor(totalPrints / ROLL_CAPACITY) + (totalPrints % ROLL_CAPACITY >= ROLL_ROUND_UP ? 1 : 0);

  return (
    <>
      <PageHead eyebrow="Monitor" title="Dashboard" subtitle="Latest prints and sequence health" />

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="card border-[var(--accent)]" style={{ background: 'linear-gradient(180deg, var(--accent-soft) 0%, var(--surface) 60%)' }}>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Last printed overall</div>
          {lo ? (
            <>
              <StudyPill name={lo.study_name} />
              <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-1">
                <div>
                  <div className="mono text-2xl leading-tight">{serialLabel(lo.start_serial, lo.serial_prefix)}</div>
                  {lo.start_code && <div className="mono text-lg text-[var(--muted)]">{lo.start_code}</div>}
                </div>
                <div className="mono text-2xl leading-tight text-[var(--muted)]">→</div>
                <div>
                  <div className="mono text-2xl leading-tight">{serialLabel(lo.end_serial, lo.serial_prefix)}</div>
                  {lo.end_code && <div className="mono text-lg text-[var(--muted)]">{lo.end_code}</div>}
                </div>
              </div>
              <div className="mt-2 text-sm text-[var(--muted)]">
                {fmtDate(lo.date_printed)} · {fmtNum(lo.end_serial - lo.start_serial + 1)} barcodes · signed {lo.printed_by || '—'}
                {lo.notes ? ` · ${lo.notes}` : ''}
              </div>
            </>
          ) : (
            <div className="text-sm text-[var(--muted)]">No prints recorded.</div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Batches', data.segments.length],
            ['Barcode rolls issued', fmtNum(rolls), false, undefined, `${fmtNum(totalPrints)} prints · 10,000 per roll`],
            ['Gaps', gaps.length, false, gaps.length ? 'var(--warn)' : 'var(--ok)'],
            ['Overlaps', overlaps.length, false, overlaps.length ? 'var(--danger)' : 'var(--ok)'],
          ].map(([label, value, mono, color, hint]) => (
            <div key={label} className="card" title={hint || undefined}>
              <div className="text-xs text-[var(--muted)]">{label}</div>
              <div className={`mt-1.5 text-2xl font-semibold ${mono ? 'mono text-xl' : ''}`} style={color ? { color } : undefined}>{value}</div>
              {hint && <div className="mt-0.5 text-xs text-[var(--faint)]">{hint}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Serial sequence</span>
          <span className="mono text-xs text-[var(--muted)]">{minStart} → {maxEnd}</span>
        </div>
        <SequenceRibbon segments={data.segments} minStart={minStart} maxEnd={maxEnd} onSelect={setSelected} />
        <ContinuityNote issues={data.issues} />
      </div>

      <h2 className="mt-7 mb-3 text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Last print by study</h2>
      <div className="table-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-[var(--muted)]" style={{ borderColor: 'var(--line)' }}>
              <th className="px-4 py-3">Study</th><th className="px-4 py-3">Last printed</th><th className="px-4 py-3">Ending barcode</th><th className="px-4 py-3">Sets</th><th className="px-4 py-3">Signed</th>
            </tr>
          </thead>
          <tbody>
            {data.lastByStudy.map(({ study, batch }) => (
              <tr key={study.id} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                <td className="px-4 py-3"><StudyPill name={study.name} /></td>
                <td className="px-4 py-3">{batch ? fmtDate(batch.date_printed) : <span className="mono text-xs text-[var(--muted)]">Never</span>}</td>
                <td className="mono px-4 py-3">{batch ? serialLabel(batch.end_serial, batch.serial_prefix) : '—'}{batch?.end_code && <div className="text-xs text-[var(--muted)]">{batch.end_code}</div>}</td>
                <td className="px-4 py-3">{batch ? (batch.set_count ?? '—') : '—'}</td>
                <td className="px-4 py-3">{batch ? (batch.printed_by || '—') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-7 mb-3 text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Recent printing events</h2>
      <div className="table-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-[var(--muted)]" style={{ borderColor: 'var(--line)' }}>
              <th className="px-4 py-3">Date</th><th className="px-4 py-3">Study</th><th className="px-4 py-3">Range</th><th className="px-4 py-3">Signed</th><th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody>
            {data.recent.map((b) => (
              <tr key={b.id} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                <td className="px-4 py-3">{fmtDate(b.date_printed)}</td>
                <td className="px-4 py-3"><StudyPill name={b.study_name} /></td>
                <td className="mono px-4 py-3">{serialLabel(b.start_serial, b.serial_prefix)}<br />{serialLabel(b.end_serial, b.serial_prefix)}</td>
                <td className="px-4 py-3">{b.printed_by || '—'}</td>
                <td className="px-4 py-3"><span className={`pill ${b.source === 'vendor' ? 'pill-danger' : 'pill-internal'}`}>{b.source}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.study_name}>
        {selected && (
          <>
            <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{selected.study_name}</h3>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-xs text-[var(--muted)]">Start</div><div className="mono text-base">{serialLabel(selected.start_serial, selected.serial_prefix)}</div></div>
              <div><div className="text-xs text-[var(--muted)]">End</div><div className="mono text-base">{serialLabel(selected.end_serial, selected.serial_prefix)}</div></div>
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {fmtNum(selected.end_serial - selected.start_serial + 1)} barcodes · printed {fmtDate(selected.date_printed)}
            </p>
            <div className="mt-4 flex justify-end"><button type="button" className="btn" onClick={() => setSelected(null)}>Close</button></div>
          </>
        )}
      </Modal>
    </>
  );
}
