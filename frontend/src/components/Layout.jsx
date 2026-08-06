import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { ROLE_LABEL, initials } from '../utils/format';

const navLinkClass = ({ isActive }) =>
  `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
    isActive
      ? 'text-[var(--accent)]'
      : 'text-[var(--muted)] hover:bg-[var(--line-2)] hover:text-[var(--ink)]'
  }`;

function navStyle({ isActive }) {
  return isActive ? { background: 'var(--accent-soft)' } : undefined;
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export default function Layout() {
  const { user, signOut, isAdminOrAbove } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const items = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/batches', label: 'Batches' },
    ...(isAdminOrAbove ? [{ to: '/studies', label: 'Studies' }] : []),
    ...(isAdminOrAbove ? [{ to: '/users', label: 'Users' }] : []),
  ];

  const sidebarBody = (
    <div className="flex h-full flex-col gap-1">
      <div className="hidden items-center gap-2.5 px-2 pb-4 lg:flex">
        <Logo />
        <span className="font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Barcode Tracker
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass} style={navStyle}>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      <ThemeToggle className="mb-1 w-full" />
      <NavLink to="/security" className={navLinkClass} style={navStyle}>Security</NavLink>

      <div className="mt-2 flex items-center gap-2.5 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          {initials(user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{user.name}</div>
          <div className="text-xs capitalize text-[var(--faint)]">{ROLE_LABEL[user.role] || user.role}</div>
        </div>
        <button type="button" className="btn px-2 py-2" onClick={signOut} title="Sign out">Out</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Mobile / tablet top bar */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Barcode Tracker
          </span>
        </div>
        <button
          type="button"
          className="btn px-2.5 py-2"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
      </header>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'var(--backdrop)' }}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[80%] max-w-[300px] flex-col border-r p-4 transition-transform duration-200 ease-out lg:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Barcode Tracker
            </span>
          </div>
          <button
            type="button"
            className="btn px-2.5 py-2"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {sidebarBody}
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden border-r p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        {sidebarBody}
      </aside>

      <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-10">
        <Outlet />
      </main>
    </div>
  );
}
