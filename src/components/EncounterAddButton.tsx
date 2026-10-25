import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import type { Monster } from '../types';

/**
 * Adds a monster to an encounter. With a single encounter it adds directly;
 * with several it opens a styled picker (same pattern as the condition popover)
 * so the DM chooses which encounter.
 */
export function EncounterAddButton({ monster, label = '+enc' }: { monster: Monster; label?: string }) {
  const encounters = useStore((s) => s.encounters);
  const addToEncounter = useStore((s) => s.addToEncounter);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const click = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (encounters.length <= 1) {
      addToEncounter(monster);
    } else {
      setOpen((o) => !o);
    }
  };

  return (
    <span className="enc-add" ref={ref}>
      <button className="btn sm" title="Add to encounter" onClick={click}>
        {label}
      </button>
      {open && encounters.length > 1 && (
        <div className="enc-add-popover" onClick={(e) => e.stopPropagation()}>
          <div className="enc-add-head">Add to…</div>
          {encounters.map((enc) => (
            <button
              key={enc.id}
              className="enc-add-opt"
              onClick={() => {
                addToEncounter(monster, enc.id);
                setOpen(false);
              }}
            >
              {enc.name}
              <span className="enc-add-count">{enc.entries.reduce((a, e) => a + e.count, 0)}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
