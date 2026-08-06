export default function Logo({ className = 'h-6 w-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect className="fill-[var(--accent)]" x="2" y="4" width="1.6" height="16" />
      <rect className="fill-[var(--ink)]" x="5" y="4" width="1" height="16" />
      <rect className="fill-[var(--ink)]" x="7.5" y="4" width="2" height="16" />
      <rect className="fill-[var(--ink)]" x="11" y="4" width="1" height="16" />
      <rect className="fill-[var(--accent)]" x="13.5" y="4" width="2.4" height="16" />
      <rect className="fill-[var(--ink)]" x="17.5" y="4" width="1" height="16" />
      <rect className="fill-[var(--ink)]" x="20" y="4" width="1.8" height="16" />
    </svg>
  );
}
