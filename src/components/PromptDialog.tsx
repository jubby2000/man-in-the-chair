import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

/** Themed replacement for window.prompt. Mount once; driven by store.prompt(). */
export function PromptDialog() {
  const state = useStore((s) => s.promptState);
  const resolvePrompt = useStore((s) => s.resolvePrompt);
  const [value, setValue] = useState('');

  // seed the field with the initial value each time a new prompt opens
  useEffect(() => {
    if (state) setValue(state.initial);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolvePrompt(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state, resolvePrompt]);

  if (!state) return null;

  const submit = () => {
    const trimmed = value.trim();
    resolvePrompt(trimmed ? trimmed : null);
  };

  return (
    <div className="modal-backdrop" onClick={() => resolvePrompt(null)}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{state.title}</h3>
        {state.message && (
          <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: '0 0 14px' }}>{state.message}</p>
        )}
        <input
          className="input"
          autoFocus
          placeholder={state.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          style={{ width: '100%', marginBottom: 18 }}
        />
        <div className="row-gap" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={() => resolvePrompt(null)}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={!value.trim()}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
