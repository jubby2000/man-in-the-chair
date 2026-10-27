import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import type { CompendiumKind } from '../types';
import { ruleSections } from '../lib/ruleSections';

// Global search across the whole compendium. Opened with Cmd/Ctrl-K (or the
// top-bar 🔍 button). Results are grouped by kind; Enter or click loads the
// entry into the Detail panel (which auto-surfaces via selectEntry).

const KIND_LABEL: Record<CompendiumKind, string> = {
  monsters: 'Monster',
  spells: 'Spell',
  items: 'Item',
  races: 'Race',
  classes: 'Class',
  backgrounds: 'Background',
  feats: 'Feat',
  conditions: 'Condition',
  rules: 'Rule',
};

// Search order (also the result grouping order).
const KIND_ORDER: CompendiumKind[] = [
  'monsters', 'spells', 'items', 'feats', 'races', 'classes', 'backgrounds', 'conditions', 'rules',
];

interface Hit {
  kind: CompendiumKind;
  id: string;
  name: string;
  meta: string;
  /** text the query is ranked against (an entry's name, or a section heading) */
  match: string;
  /** heading to scroll to inside the entry (rule sections only) */
  anchor?: string;
}

const MAX_RESULTS = 50;

export function CommandPalette() {
  const compendium = useStore((s) => s.compendium);
  const selectEntry = useStore((s) => s.selectEntry);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl-K to toggle; Escape to close. Ignore the shortcut while typing in
  // another field (except to open, which Cmd/Ctrl-K is safe for).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (open && e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // listen for the top-bar button's custom event
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener('mitc:open-search', openIt);
    return () => window.removeEventListener('mitc:open-search', openIt);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Headings inside rule text ("Making an Attack › Grappling"), built once per compendium.
  const sections = useMemo(() => ruleSections(compendium.rules), [compendium.rules]);

  const results = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const out: Hit[] = [];
    for (const kind of KIND_ORDER) {
      const list = compendium[kind] as unknown as { id: string; name: string; [k: string]: unknown }[];
      for (const e of list) {
        if (e.name.toLowerCase().includes(needle)) {
          out.push({ kind, id: e.id, name: e.name, meta: metaFor(kind, e), match: e.name });
          if (out.length >= MAX_RESULTS * 2) break;
        }
      }
    }
    for (const sec of sections) {
      if (sec.heading.toLowerCase().includes(needle)) {
        out.push({
          kind: 'rules',
          id: sec.ruleId,
          anchor: sec.anchor,
          name: `${sec.ruleName} › ${sec.heading}`,
          meta: sec.parents.join(' › '),
          match: sec.heading,
        });
      }
    }
    // starts-with ranks above contains; exact match first
    const rank = (h: Hit) => {
      const m = h.match.toLowerCase();
      return m === needle ? 0 : m.startsWith(needle) ? 1 : 2;
    };
    out.sort((a, b) => rank(a) - rank(b) || a.match.localeCompare(b.match) || a.name.localeCompare(b.name));
    return out.slice(0, MAX_RESULTS);
  }, [q, compendium]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  const choose = (hit: Hit) => {
    selectEntry(hit.kind, hit.id, hit.anchor); // loads into Detail (+ scrolls to a section)
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  };

  if (!open) return null;

  return (
    <div className="cmdk-backdrop" onClick={() => setOpen(false)}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Search the compendium — monsters, spells, items, feats…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        <div className="cmdk-results">
          {q.trim() === '' ? (
            <div className="cmdk-hint">Type to search across everything. ↑↓ to navigate, ↵ to open.</div>
          ) : results.length === 0 ? (
            <div className="cmdk-hint">No matches for “{q}”.</div>
          ) : (
            results.map((hit, i) => (
              <button
                key={hit.kind + hit.id + (hit.anchor ?? '')}
                className={`cmdk-row ${i === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(hit)}
              >
                <span className="cmdk-name">{hit.name}</span>
                <span className="cmdk-meta">
                  {hit.meta && <span className="cmdk-metatext">{hit.meta}</span>}
                  <span className="cmdk-kind">{KIND_LABEL[hit.kind]}</span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="cmdk-footer">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

function metaFor(kind: CompendiumKind, e: Record<string, unknown>): string {
  switch (kind) {
    case 'monsters':
      return `CR ${e.cr ?? '—'}`;
    case 'spells':
      return e.level === 0 ? 'Cantrip' : `Lv ${e.level}`;
    case 'items':
      return String(e.rarity || e.category || '');
    default:
      return '';
  }
}
