import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';

const MAX_STUDIES = 3;

export default function SignUpPage() {
  const navigate = useNavigate();
  const [studies, setStudies] = useState([]);
  const [studiesLoading, setStudiesLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    studyIds: [],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api('/api/auth/signup/studies', { auth: false })
      .then(({ studies: list }) => setStudies(list))
      .catch(() => setError('Could not load studies from the database. Try again later.'))
      .finally(() => setStudiesLoading(false));
  }, []);

  const toggleStudy = (id) => {
    setForm((prev) => {
      const selected = prev.studyIds.includes(id);
      if (selected) {
        return { ...prev, studyIds: prev.studyIds.filter((sid) => sid !== id) };
      }
      if (prev.studyIds.length >= MAX_STUDIES) return prev;
      return { ...prev, studyIds: [...prev.studyIds, id] };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Enter your name.');
      return;
    }
    if (!form.email.trim()) {
      setError('Enter your email.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.studyIds.length === 0) {
      setError('Select at least one study.');
      return;
    }

    setLoading(true);
    try {
      await api('/api/auth/register', {
        auth: false,
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          confirm_password: form.confirmPassword,
          study_ids: form.studyIds,
        }),
      });
      // Registration never reveals whether the email already existed — go sign in.
      navigate('/login?registered=1', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center p-6">
      <ThemeToggle className="absolute right-5 top-5" />
      <div
        className="w-full max-w-md rounded-xl border p-8"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow)' }}
      >
        <div className="mb-1 flex items-center gap-3">
          <Logo />
          <span className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Create account
          </span>
        </div>
        <p className="mb-6 text-sm text-[var(--muted)]">
          Register to track barcode batches. Choose up to {MAX_STUDIES} studies.
        </p>

        {error && <div className="banner banner-error">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="name">Name</label>
            <input
              id="name"
              className="input"
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Studies</label>
              <span className="text-xs text-[var(--muted)]">{form.studyIds.length} / {MAX_STUDIES} selected</span>
            </div>
            <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border p-2" style={{ borderColor: 'var(--line)' }}>
              {studiesLoading ? (
                <p className="px-2 py-3 text-sm text-[var(--muted)]">Loading studies…</p>
              ) : studies.length === 0 ? (
                <p className="px-2 py-3 text-sm text-[var(--muted)]">No studies in the database yet.</p>
              ) : studies.map((study) => {
                const checked = form.studyIds.includes(study.id);
                const disabled = !checked && form.studyIds.length >= MAX_STUDIES;
                return (
                  <label
                    key={study.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
                    style={{ borderColor: 'var(--line)', background: checked ? 'var(--accent-soft)' : 'transparent' }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleStudy(study.id)}
                    />
                    <span>{study.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[var(--muted)]">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-[var(--accent)] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
