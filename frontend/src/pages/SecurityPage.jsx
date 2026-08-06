import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PageHead from '../components/PageHead';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

export default function SecurityPage() {
  const { updateUser } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const load = () => api('/api/me').then(({ user }) => {
    setProfile(user);
    updateUser(user);
  });

  useEffect(() => { load(); }, []);

  if (!profile) return <div className="text-[var(--muted)]">Loading…</div>;

  const startSetup = async () => {
    const data = await api('/api/auth/mfa/setup', { method: 'POST' });
    setSetup(data);
    setSetupOpen(true);
  };

  const enableMfa = async () => {
    setError('');
    try {
      await api('/api/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ code: code.trim() }) });
      setSetupOpen(false);
      setCode('');
      showToast('Two-factor authentication enabled.', 'ok');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const disableMfa = async () => {
    setError('');
    try {
      await api('/api/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ password, code: code.trim() }),
      });
      setDisableOpen(false);
      setPassword('');
      setCode('');
      showToast('Two-factor authentication disabled.', 'ok');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <PageHead eyebrow="Account" title="Security" subtitle="Two-factor authentication" />
      <div className="card">
        <p className="mb-4 text-sm text-[var(--muted)]">
          After enabling 2FA, sign-in becomes a two-step process: password, then a code from your authenticator app.
        </p>
        <div className={`banner ${profile.mfa_enabled ? 'banner-ok' : 'banner-warn'} mb-4`}>
          {profile.mfa_enabled ? '2FA is enabled on your account.' : '2FA is not enabled yet.'}
        </div>
        {profile.mfa_enabled
          ? <button type="button" className="btn" onClick={() => setDisableOpen(true)}>Disable 2FA</button>
          : <button type="button" className="btn btn-primary" onClick={startSetup}>Set up 2FA</button>}
      </div>

      <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Set up authenticator">
        <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Set up authenticator</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">Add this secret to Google Authenticator, Authy, or similar. Then enter the 6-digit code to confirm.</p>
        {error && <div className="banner banner-error mt-4">{error}</div>}
        {setup && (
          <div className="mt-4 space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium">Secret key</label><input className="input mono" readOnly value={setup.secret} /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Verification code</label><input className="input mono" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" /></div>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setSetupOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={enableMfa}>Enable 2FA</button>
        </div>
      </Modal>

      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="Disable 2FA">
        <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Disable 2FA</h3>
        {error && <div className="banner banner-error mt-4">{error}</div>}
        <div className="mt-4 space-y-4">
          <div><label className="mb-1.5 block text-sm font-medium">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Current authenticator code</label><input className="input mono" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setDisableOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={disableMfa}>Disable</button>
        </div>
      </Modal>
    </>
  );
}
