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

  // Resolve a raw book name through aliases to { key, label }. Mirrors the
  // Compendium panel: an alias is a DISPLAY NAME that both re-labels and (via
  // its normalized key) re-groups the book.
  const resolve = (raw: string): { key: string; label: string } => {
    const label = bookAliases[bookKey(raw)] ?? raw;
    return { key: bookKey(label), label };
  };

  // Group books by resolved key across the whole compendium.
  const books = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const k of KINDS) {
      for (const e of compendium[k] as { publication?: string }[]) {
        if (!e.publication) continue;
        const { key, label } = resolve(publicationBook(e.publication));
        const existing = map.get(key);
        if (existing) existing.count += 1;
        else map.set(key, { label, count: 1 });
      }
    }
    return [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compendium, bookAliases]);

  // Display names to suggest as merge targets in the datalist.
  const allLabels = useMemo(() => books.map(([, v]) => v.label).sort(), [books]);

  const activeMerges = Object.entries(bookAliases);

  const startEdit = (key: string, label: string) => {
    setEditing(key);
    setDraft(label);
  };
  // The alias is keyed by the entry's ORIGINAL base key (the key the entries
  // naturally group under), mapping to the typed display name. We store it
  // under every base key currently folded into `editing` so the rename sticks.
  const save = async () => {
    if (editing) {
      const target = draft.trim();
      // find all raw base keys that currently resolve to the editing key
      const bases = new Set<string>();
      for (const k of KINDS) {
        for (const e of compendium[k] as { publication?: string }[]) {
          if (!e.publication) continue;
          const raw = publicationBook(e.publication);
          if (resolve(raw).key === editing) bases.add(bookKey(raw));
        }
      }
      for (const b of bases) await setBookAlias(b, target);
    }
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
