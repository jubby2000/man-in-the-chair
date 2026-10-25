import { useEffect } from 'react';
import { useStore } from '../store/useStore';

/** Themed replacement for window.confirm. Mount once; driven by store.confirm(). */
export function ConfirmDialog() {
  const state = useStore((s) => s.confirmState);
  const resolveConfirm = useStore((s) => s.resolveConfirm);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveConfirm(false);
      else if (e.key === 'Enter') resolveConfirm(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state, resolveConfirm]);

  if (!state) return null;

  return (
    <div className="modal-backdrop" onClick={() => resolveConfirm(false)}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{state.title}</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: '0 0 18px' }}>{state.message}</p>
        <div className="row-gap" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={() => resolveConfirm(false)}>
            Cancel
          </button>
          <button
            className={`btn ${state.danger ? 'danger' : 'primary'}`}
            autoFocus
            onClick={() => resolveConfirm(true)}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
