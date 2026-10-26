import { useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { Popover } from './Popover';
import type { Monster } from '../types';

/**
 * Adds a monster to an encounter. With a single encounter it adds directly;
 * with several it opens a styled picker (portaled so it isn't clipped by the
 * panel) so the DM chooses which encounter.
 */
export function EncounterAddButton({ monster, label = '+enc' }: { monster: Monster; label?: string }) {
  const encounters = useStore((s) => s.encounters);
  const addToEncounter = useStore((s) => s.addToEncounter);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const click = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (encounters.length <= 1) {
      addToEncounter(monster);
    } else {
      setOpen((o) => !o);
    }
  };

  return (
    <span className="enc-add">
      <button ref={btnRef} className="btn sm" title="Add to encounter" onClick={click}>
        {label}
      </button>
      {open && encounters.length > 1 && (
        <Popover anchorRef={btnRef} open={open} onClose={() => setOpen(false)} align="right">
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
        </Popover>
      )}
    </span>
  );
}
