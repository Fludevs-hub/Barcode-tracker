import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PageHead from '../components/PageHead';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { StudyPill } from '../components/SequenceRibbon';
import { ROLE_LABEL } from '../utils/format';

const ROLE_NOTE = {
  super_admin: 'Full control — all studies, users, and role changes',
  admin: 'Manages studies, users (operator/user), and study access',
  operator: 'Records batches · sees all',
  user: 'Records & sees assigned studies only',
};

export default function UsersPage() {
  const { user: me, updateUser, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [assignable, setAssignable] = useState([]);
  const [studies, setStudies] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignUser, setAssignUser] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ display_name: '', username: '', password: '', email: '', role: 'user', study_ids: [] });
  const [error, setError] = useState('');

  const load = () => Promise.all([api('/api/users'), api('/api/studies')]).then(([{ users: u, assignable_roles: a }, { studies: s }]) => {
    setUsers(u);
    setAssignable(a);
    setStudies(s);
    if (!form.role && a.length) setForm((f) => ({ ...f, role: a[0] }));
  });

  useEffect(() => { load(); }, []);

  const changeRole = async (id, role, prev) => {
    try {
      const r = await api(`/api/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
      showToast('Role updated.', 'ok');
      if (id === me.id) updateUser({ role: r.role });
      else load();
    } catch (e) {
      showToast(e.message, 'error');
      return prev;
    }
    return role;
  };

  const createUser = async () => {
    setError('');
    try {
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          display_name: form.display_name.trim(),
          username: form.username.trim(),
          password: form.password,
          email: form.email.trim() || null,
          role: form.role,
          study_ids: form.role === 'user' ? form.study_ids : [],
        }),
      });
      setCreateOpen(false);
      showToast('User created.', 'ok');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const saveAccess = async (userId, studyIds) => {
    await api(`/api/users/${userId}/studies`, { method: 'PUT', body: JSON.stringify({ study_ids: studyIds }) });
    setAssignUser(null);
    showToast('Access updated.', 'ok');
    load();
  };

  const saveProfile = async (userId, patch) => {
    const r = await api(`/api/users/${userId}`, { method: 'PUT', body: JSON.stringify(patch) });
    setEditUser(null);
    showToast('User updated.', 'ok');
    if (userId === me.id) updateUser({ name: patch.display_name });
    load();
    return r;
  };

  const studyName = (id) => studies.find((s) => s.id === id)?.name || '';

  return (
    <>
      <PageHead eyebrow="Users" title="Users & access" subtitle="Roles and per-study access" />
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={() => setCreateOpen(true)}>New user</button>
      </div>

      <div className="table-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-[var(--muted)]" style={{ borderColor: 'var(--line)' }}>
              <th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Assigned studies</th><th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b align-top" style={{ borderColor: 'var(--line-2)' }}>
                <td className="px-4 py-3">
                  <strong>{u.display_name}</strong>{u.id === me.id && <span className="mono ml-1 text-xs text-[var(--muted)]">(you)</span>}
                  <div className="mono text-xs text-[var(--muted)]">{u.username}</div>
                  {u.email && <div className="mono text-xs text-[var(--faint)]">{u.email}</div>}
                </td>
                <td className="px-4 py-3">
                  <select
                    className="input max-w-[170px]"
                    value={u.role}
                    onChange={async (e) => {
                      const prev = u.role;
                      const next = await changeRole(u.id, e.target.value, prev);
                      e.target.value = next;
                    }}
                  >
                    {assignable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    {!assignable.includes(u.role) && <option value={u.role}>{ROLE_LABEL[u.role]}</option>}
                  </select>
                  <div className="mt-1 text-xs text-[var(--muted)]">{ROLE_NOTE[u.role]}</div>
                </td>
                <td className="px-4 py-3">
                  {u.role === 'user'
                    ? (u.studies.length
                      ? u.studies.map((id) => <span key={id} className="pill pill-study m-0.5">{studyName(id)}</span>)
                      : <span className="mono text-xs text-[var(--muted)]">None assigned</span>)
                    : <span className="mono text-xs text-[var(--muted)]">All studies</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    {u.role === 'user' && <button type="button" className="btn px-3 py-1.5" onClick={() => setAssignUser(u)}>Edit access</button>}
                    {isSuperAdmin && <button type="button" className="btn px-3 py-1.5" onClick={() => setEditUser(u)}>Edit</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New user">
        <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>New user</h3>
        {error && <div className="banner banner-error mt-4">{error}</div>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1.5 block text-sm font-medium">Display name</label><input className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Username</label><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Email (for Google/Microsoft sign-in)</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Password</label><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {assignable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
        </div>
        {form.role === 'user' && (
          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium">Assigned studies</label>
            {studies.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--line)' }}>
                <input type="checkbox" checked={form.study_ids.includes(s.id)} onChange={(e) => {
                  setForm({
                    ...form,
                    study_ids: e.target.checked
                      ? [...form.study_ids, s.id]
                      : form.study_ids.filter((id) => id !== s.id),
                  });
                }} />
                {s.name}
              </label>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setCreateOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={createUser}>Create user</button>
        </div>
      </Modal>

      <Modal open={!!assignUser} onClose={() => setAssignUser(null)} title="Study access">
        {assignUser && (
          <>
            <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Study access — {assignUser.display_name}</h3>
            <StudyAccessForm user={assignUser} studies={studies} onSave={(ids) => saveAccess(assignUser.id, ids)} onCancel={() => setAssignUser(null)} />
          </>
        )}
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit user">
        {editUser && (
          <EditProfileForm user={editUser} onSave={(patch) => saveProfile(editUser.id, patch)} onCancel={() => setEditUser(null)} />
        )}
      </Modal>
    </>
  );
}

function EditProfileForm({ user, onSave, onCancel }) {
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [email, setEmail] = useState(user.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError('');
    setSaving(true);
    try {
      await onSave({
        display_name: displayName.trim(),
        email: email.trim() || null,
        ...(password ? { password } : {}),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Edit user — {user.username}</h3>
      {error && <div className="banner banner-error mt-4">{error}</div>}
      <div className="mt-4 space-y-4">
        <div><label className="mb-1.5 block text-sm font-medium">Display name</label><input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
        <div><label className="mb-1.5 block text-sm font-medium">Email (for Google/Microsoft sign-in)</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="mb-1.5 block text-sm font-medium">New password (optional)</label><input className="input" type="password" placeholder="Leave blank to keep current" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </>
  );
}

function StudyAccessForm({ user, studies, onSave, onCancel }) {
  const [selected, setSelected] = useState(user.studies);
  return (
    <>
      <p className="mt-2 mb-4 text-sm text-[var(--muted)]">This user can view and record batches only for the studies you check.</p>
      <div className="space-y-2">
        {studies.map((s) => (
          <label key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--line)' }}>
            <input type="checkbox" checked={selected.includes(s.id)} onChange={(e) => {
              setSelected(e.target.checked ? [...selected, s.id] : selected.filter((id) => id !== s.id));
            }} />
            {s.name}
          </label>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={() => onSave(selected)}>Save access</button>
      </div>
    </>
  );
}
