import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { publicationBook } from '../lib/import';
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
  const [draft, setDraft] = useState('');

  // Count entries per canonical (post-alias) book across the whole compendium.
  const books = useMemo(() => {
    const counts = new Map<string, number>();
    for (const k of KINDS) {
      for (const e of compendium[k] as { publication?: string }[]) {
        if (!e.publication) continue;
        const base = publicationBook(e.publication);
        const canon = bookAliases[base] ?? base;
        counts.set(canon, (counts.get(canon) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [compendium, bookAliases]);

  // Pre-alias base names (merge targets to pick from) for the datalist.
  const allBaseNames = useMemo(() => {
    const set = new Set<string>();
    for (const k of KINDS) {
      for (const e of compendium[k] as { publication?: string }[]) {
        if (e.publication) {
          const base = publicationBook(e.publication);
          set.add(bookAliases[base] ?? base);
        }
      }
    }
    return [...set].sort();
  }, [compendium, bookAliases]);

  // active merges (alias -> canonical) for the "undo" list
  const activeMerges = Object.entries(bookAliases);

  const startEdit = (name: string) => {
    setEditing(name);
    setDraft(name);
  };
  const save = async () => {
    if (editing) await setBookAlias(editing, draft);
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
            books.map(([name, count]) => (
              <div className="cleanup-row" key={name}>
                {editing === name ? (
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
                    <span className="cleanup-name" title={name}>{name}</span>
                    <span className="meta cleanup-count">{count}</span>
                    <button className="btn sm" onClick={() => startEdit(name)}>Rename / merge</button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <datalist id="cleanup-books">
          {allBaseNames.map((n) => <option key={n} value={n} />)}
        </datalist>

        {activeMerges.length > 0 && (
          <div className="cleanup-merges">
            <div className="section-label">Active merges</div>
            {activeMerges.map(([from, to]) => (
              <div className="cleanup-merge-row" key={from}>
                <span className="meta">
                  “{from}” → <b>{to}</b>
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
