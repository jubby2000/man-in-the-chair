import { useState } from 'react';
import { useDbStatus, type DbIssue } from '../lib/dbStatus';
import { downloadRawBackup } from '../lib/backup';

const COPY: Record<DbIssue, { title: string; body: string }> = {
  newer: {
    title: 'Your data is from a newer version',
    body: 'Your saved data was written by a newer version of Man in the Chair than this one, so this copy won’t touch it. Nothing has been changed or lost. Reload to get the latest version.',
  },
  stale: {
    title: 'Updated in another tab',
    body: 'Man in the Chair was updated in another tab or window. Reload this one to keep working. Nothing is lost.',
  },
  blocked: {
    title: 'Finishing an update',
    body: 'An update needs to change how your data is stored, but another Man in the Chair tab or window is still open. Close the others and this will continue by itself.',
  },
  failed: {
    title: 'Can’t open your saved data',
    body: 'Your browser wouldn’t open the app’s storage. This usually means a private or restricted window, or a full disk. Your data has not been changed.',
  },
};

/** Full-screen explanation when the app can't safely use its saved data. */
export function DbNotice() {
  const issue = useDbStatus((s) => s.issue);
  const detail = useDbStatus((s) => s.detail);
  const [msg, setMsg] = useState('');

  if (!issue) return null;
  const { title, body } = COPY[issue];
  const canRecover = issue === 'newer' || issue === 'failed';

  const recover = async () => {
    try {
      setMsg((await downloadRawBackup()) ? 'Saved a copy of your data to your downloads.' : 'No saved data was found.');
    } catch {
      setMsg('Couldn’t read the saved data.');
    }
  };

  return (
    <div className="modal-backdrop" role="alertdialog" aria-modal="true" aria-label={title} style={{ zIndex: 2000 }}>
      <div className="modal confirm-modal">
        <h3>{title}</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: '0 0 12px' }}>{body}</p>
        {detail && (
          <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: '0 0 12px', fontFamily: 'var(--font-mono)' }}>
            {detail}
          </p>
        )}
        {msg && <p style={{ fontSize: 13, margin: '0 0 12px' }}>{msg}</p>}
        <div className="row-gap" style={{ justifyContent: 'flex-end' }}>
          {canRecover && (
            <button className="btn ghost" onClick={() => void recover()}>
              Download a copy of my data
            </button>
          )}
          <button className="btn primary" autoFocus onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
