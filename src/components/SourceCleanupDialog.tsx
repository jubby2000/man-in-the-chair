import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { publicationBook, bookKey } from '../lib/import';
import type { CompendiumKind } from '../types';

const KINDS: CompendiumKind[] = [
  'monsters', 'spells', 'items', 'conditions', 'rules',
  'races', 'classes', 'backgrounds', 'feats',
];

/** Lists distinct book names (after auto-cleanup) with counts, letting the DM
 *  merge the long-tail variants auto-normalization can't safely collapse. */
export function SourceCleanupDialog({ onClose }: { onClose: () => void }) {
  const compendium = useStore((s) => s.compendium);
  const bookAliases = useStore((s) => s.bookAliases);
  const setBookAlias = useStore((s) => s.setBookAlias);
  const clearBookAlias = useStore((s) => s.clearBookAlias);
  const [editing, setEditing] = useState<string | null>(null);
  // editing holds the KEY being renamed; draft is the typed display text
  const [draft, setDraft] = useState('');

  // Group books by case-insensitive key (post-alias) across the whole
  // compendium: { key -> { label (display name), count } }.
  const books = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const k of KINDS) {
      for (const e of compendium[k] as { publication?: string }[]) {
        if (!e.publication) continue;
        const base = bookKey(publicationBook(e.publication));
        const key = bookAliases[base] ?? base;
        const existing = map.get(key);
        if (existing) existing.count += 1;
        else map.set(key, { label: publicationBook(e.publication), count: 1 });
      }
    }
    return [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [compendium, bookAliases]);

  // Display names to suggest as merge targets in the datalist.
  const allLabels = useMemo(() => books.map(([, v]) => v.label).sort(), [books]);
  // key -> label, to render active merges in human terms
  const labelFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const [key, v] of books) m.set(key, v.label);
    return m;
  }, [books]);

  const activeMerges = Object.entries(bookAliases);

  const startEdit = (key: string, label: string) => {
    setEditing(key);
    setDraft(label);
  };
  const save = async () => {
    if (editing) await setBookAlias(editing, bookKey(draft));
    setEditing(null);
    setDraft('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal cleanup-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Clean up sources</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 14px' }}>
          Book names are auto-cleaned (page numbers, punctuation). Rename any book below to merge
          variants the cleanup missed — type an existing book's exact name to fold this one into it.
        </p>

        <div className="cleanup-list">
          {books.length === 0 ? (
            <div className="empty">No imported sources carry a book name.</div>
          ) : (
            books.map(([key, { label, count }]) => (
              <div className="cleanup-row" key={key}>
                {editing === key ? (
                  <>
                    <input
                      className="input"
                      autoFocus
                      list="cleanup-books"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void save();
                        if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                    <button className="btn sm primary" onClick={() => void save()}>Save</button>
                    <button className="btn sm ghost" onClick={() => setEditing(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="cleanup-name" title={label}>{label}</span>
                    <span className="meta cleanup-count">{count}</span>
                    <button className="btn sm" onClick={() => startEdit(key, label)}>Rename / merge</button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <datalist id="cleanup-books">
          {allLabels.map((n) => <option key={n} value={n} />)}
        </datalist>

        {activeMerges.length > 0 && (
          <div className="cleanup-merges">
            <div className="section-label">Active merges</div>
            {activeMerges.map(([from, to]) => (
              <div className="cleanup-merge-row" key={from}>
                <span className="meta">
                  “{from}” → <b>{labelFor.get(to) ?? to}</b>
                </span>
                <button className="btn sm ghost" onClick={() => void clearBookAlias(from)}>
                  Undo
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
