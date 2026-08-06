import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { persistSession } from '../api/client';
import { useAuth } from '../context/AuthContext';

function decodeBase64Url(value) {
  const pad = '='.repeat((4 - (value.length % 4)) % 4);
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return JSON.parse(atob(b64));
}

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { setOAuthSession } = useAuth();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      navigate('/login', { replace: true });
      return;
    }

    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const userB64 = params.get('user');

    if (!token || !userB64) {
      navigate('/login?oauth_error=Invalid%20OAuth%20response', { replace: true });
      return;
    }

    try {
      const user = decodeBase64Url(userB64);
      // Refresh token was set as an httpOnly cookie during the OAuth redirect.
      const session = { token, user };
      persistSession(session);
      setOAuthSession(session);
      navigate('/', { replace: true });
    } catch {
      navigate('/login?oauth_error=Could%20not%20complete%20sign-in', { replace: true });
    }
  }, [navigate, setOAuthSession]);

  return (
    <div className="grid min-h-screen place-items-center text-[var(--muted)]">
      Completing sign-in…
    </div>
  );
}
