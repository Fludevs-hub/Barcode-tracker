export default function PageHead({ eyebrow, title, subtitle }) {
  return (
    <div className="mb-7">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="page-title mt-1.5">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[var(--muted)]">{subtitle}</p>}
    </div>
  );
}
