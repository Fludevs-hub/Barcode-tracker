import { fmtNum } from '../utils/format';
import { studyColor } from '../utils/studyColors';

export default function SequenceRibbon({ segments, minStart, maxEnd, onSelect }) {
  const span = maxEnd - minStart + 1;
  let cursor = minStart;
  const parts = [];

  for (const s of segments) {
    if (s.start_serial > cursor) {
      parts.push(
        <div
          key={`gap-${cursor}`}
          className="min-w-[2px] border-x border-dashed"
          style={{
            width: `${((s.start_serial - cursor) / span) * 100}%`,
            borderColor: 'var(--warn)',
            background: 'repeating-linear-gradient(45deg, var(--warn-soft) 0 6px, var(--gap-stripe) 6px 12px)',
          }}
          title={`Gap: ${cursor}–${s.start_serial - 1}`}
        />
      );
    }
    parts.push(
      <button
        key={s.id}
        type="button"
        className="min-w-[2px] cursor-pointer transition hover:brightness-110"
        style={{
          width: `${((s.end_serial - s.start_serial + 1) / span) * 100}%`,
          background: studyColor(s.study_name),
        }}
        title={`${s.study_name} · ${s.start_serial}–${s.end_serial}`}
        onClick={() => onSelect?.(s)}
      />
    );
    cursor = s.end_serial + 1;
  }

  return (
    <div className="flex h-14 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--line)' }}>
      {parts}
    </div>
  );
}

export function ContinuityNote({ issues }) {
  if (!issues.length) {
    return <div className="banner banner-ok mt-4">Sequence is continuous — no gaps or overlaps.</div>;
  }
  const parts = issues.map((i) =>
    i.type === 'gap'
      ? `gap of ${fmtNum(i.size)} between ${i.from} and ${i.to}`
      : `overlap near batch #${i.before}`
  );
  const cls = issues.some((i) => i.type === 'overlap') ? 'banner-error' : 'banner-warn';
  return (
    <div className={`banner ${cls} mt-4`}>
      {issues.length} issue{issues.length > 1 ? 's' : ''}: {parts.join('; ')}.
    </div>
  );
}

export function StudyPill({ name }) {
  return (
    <span className="pill pill-study">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: studyColor(name) }} />
      {name}
    </span>
  );
}
