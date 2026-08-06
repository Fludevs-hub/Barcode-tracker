import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PageHead from '../components/PageHead';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { StudyPill } from '../components/SequenceRibbon';
import { primeStudyColors } from '../utils/studyColors';

export default function StudiesPage() {
  const { isAdminOrAbove } = useAuth();
  const { showToast } = useToast();
  const [studies, setStudies] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const load = () => api('/api/studies').then(({ studies: s }) => {
    primeStudyColors(s);
    setStudies(s);
  });

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCode('');
    setError('');
    setOpen(true);
  };

  const openEdit = (study) => {
    setEditing(study);
    setName(study.name);
    setCode(study.code || '');
    setError('');
    setOpen(true);
  };

  const save = async () => {
    setError('');
    try {
      await api(editing ? `/api/studies/${editing.id}` : '/api/studies', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ name: name.trim(), code: code.trim() }),
      });
      setOpen(false);
      setEditing(null);
      setName('');
      setCode('');
      showToast(editing ? 'Study updated.' : 'Study created.', 'ok');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <PageHead eyebrow="Studies" title="Studies" subtitle="Manage the studies barcodes are printed for" />
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={openCreate}>New study</button>
      </div>
      <div className="table-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-[var(--muted)]" style={{ borderColor: 'var(--line)' }}>
              <th className="px-4 py-3">Study</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Created</th>
              {isAdminOrAbove && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {studies.map((s) => (
              <tr key={s.id} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                <td className="px-4 py-3"><StudyPill name={s.name} /></td>
                <td className="mono px-4 py-3 text-xs text-[var(--muted)]">{s.code || '—'}</td>
                <td className="px-4 py-3">{s.created_at.slice(0, 10)}</td>
                {isAdminOrAbove && (
                  <td className="px-4 py-3 text-right"><button type="button" className="btn px-3 py-1.5" onClick={() => openEdit(s)}>Edit</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit study' : 'New study'}>
        <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{editing ? 'Edit study' : 'New study'}</h3>
        {error && <div className="banner banner-error mt-4">{error}</div>}
        <div className="mt-4 space-y-4">
          <div><label className="mb-1.5 block text-sm font-medium">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Short code (optional)</label><input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save}>{editing ? 'Save changes' : 'Create study'}</button>
        </div>
      </Modal>
    </>
  );
}
