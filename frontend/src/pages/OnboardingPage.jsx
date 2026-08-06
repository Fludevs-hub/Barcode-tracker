import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';

const MAX_STUDIES = 3;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, setOAuthSession, signOut } = useAuth();
  const [studies, setStudies] = useState([]);
  const [studiesLoading, setStudiesLoading] = useState(true);
  const [studyIds, setStudyIds] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api('/api/auth/signup/studies', { auth: false })
      .then(({ studies: list }) => setStudies(list))
      .catch(() => setError('Could not load studies from the database. Try again later.'))
      .finally(() => setStudiesLoading(false));
  }, []);

  const toggleStudy = (id) => {
    setStudyIds((prev) => {
      if (prev.includes(id)) return prev.filter((sid) => sid !== id);
      if (prev.length >= MAX_STUDIES) return prev;
      return [...prev, id];
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (studyIds.length === 0) {
      setError('Select at least one study to continue.');
      return;
    }

    setLoading(true);
    try {
      const data = await api('/api/auth/onboarding/studies', {
        method: 'POST',
        body: JSON.stringify({ study_ids: studyIds }),
      });
      setOAuthSession(data);
      navigate('/', { replace: true });
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
            Choose your studies
          </span>
        </div>
        <p className="mb-6 text-sm text-[var(--muted)]">
          {user?.name ? `Welcome, ${user.name}. ` : ''}Select up to {MAX_STUDIES} studies you work on to finish setting up your account.
        </p>

        {error && <div className="banner banner-error">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Studies</label>
              <span className="text-xs text-[var(--muted)]">{studyIds.length} / {MAX_STUDIES} selected</span>
            </div>
            <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border p-2" style={{ borderColor: 'var(--line)' }}>
              {studiesLoading ? (
                <p className="px-2 py-3 text-sm text-[var(--muted)]">Loading studies…</p>
              ) : studies.length === 0 ? (
                <p className="px-2 py-3 text-sm text-[var(--muted)]">No studies in the database yet. Ask an admin to add one.</p>
              ) : studies.map((study) => {
                const checked = studyIds.includes(study.id);
                const disabled = !checked && studyIds.length >= MAX_STUDIES;
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
            {loading ? 'Saving…' : 'Continue to dashboard'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[var(--muted)]">
          <button type="button" className="font-medium text-[var(--accent)] hover:underline" onClick={signOut}>
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
