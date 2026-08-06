import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import SocialLogin from '../components/SocialLogin';

export default function LoginPage() {
  const { loginStep, pendingUser, signIn, verifyMfa, resetLogin, beginOAuthMfa } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('oauth_error');
    if (oauthError) setError(oauthError);

    if (params.get('registered')) {
      setNotice('If that email is available, your account is ready. Sign in to continue.');
    }

    const mfaToken = params.get('mfa_token');
    if (mfaToken) {
      beginOAuthMfa(mfaToken, {
        username: params.get('username') || '',
        name: params.get('name') || '',
      });
    }

    if (oauthError || mfaToken || params.get('registered')) {
      window.history.replaceState({}, '', '/login');
    }
  }, [beginOAuthMfa]);

  const submitCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(username.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyMfa(code.trim());
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
        className="w-full max-w-sm rounded-xl border p-8"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow)' }}
      >
        <div className="mb-1 flex items-center gap-3">
          <Logo />
          <span className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {loginStep === 'mfa' ? 'Verify identity' : 'Barcode Tracker'}
          </span>
        </div>
        <p className="mb-6 text-sm text-[var(--muted)]">
          {loginStep === 'mfa'
            ? <>Enter the 6-digit code from your authenticator app{pendingUser ? <> for <strong>{pendingUser.name}</strong></> : null}.</>
            : 'Sign in with your username or email, or use your organization account.'}
        </p>

        {notice && <div className="banner">{notice}</div>}
        {error && <div className="banner banner-error">{error}</div>}

        {loginStep === 'mfa' ? (
          <form onSubmit={submitMfa} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="mfa">Authentication code</label>
              <input id="mfa" className="input mono" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" />
            </div>
            <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Verifying…' : 'Verify & sign in'}</button>
            <button type="button" className="btn w-full" onClick={resetLogin}>Back</button>
          </form>
        ) : (
          <form onSubmit={submitCredentials} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="u">Username or email</label>
              <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="p">Password</label>
              <input id="p" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Signing in…' : 'Continue'}</button>
            <SocialLogin />
          </form>
        )}

        {loginStep !== 'mfa' && (
          <p className="mt-5 text-center text-sm text-[var(--muted)]">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-medium text-[var(--accent)] hover:underline">Sign up</Link>
          </p>
        )}
      </div>
    </div>
  );
}
