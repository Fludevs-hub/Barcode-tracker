import { useEffect } from 'react';

export default function Modal({ open, onClose, children, title }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-4 sm:p-6"
      style={{ background: 'var(--backdrop)' }}
    >
      <div
        className="flex min-h-full items-center justify-center"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="w-full max-w-xl rounded-xl border p-5 sm:p-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow)' }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
