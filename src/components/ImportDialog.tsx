import { useRef, useState } from 'react';
import { useStore } from '../store/useStore';

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const imports = useStore((s) => s.imports);
  const importFile = useStore((s) => s.importFile);
  const removeImport = useStore((s) => s.removeImport);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      for (const file of Array.from(files)) {
        const text = await file.text();
        const src = await importFile(file.name, text);
        const total = Object.values(src.counts).reduce((a, b) => a + b, 0);
        setMsg(`Imported “${src.name}” — ${total} entries.`);
      }
    } catch (err) {
      setMsg(`Import failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Compendium Sources</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 0 }}>
          Import FightClub5e-compatible <code>.xml</code> or native <code>.json</code>.
          Everything stays in your browser.
        </p>

        <div
          className={`dropzone ${drag ? 'drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? 'Importing…' : 'Drop files here, or click to choose'}
          <input
            ref={fileInput}
            type="file"
            accept=".xml,.json"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>

        {msg && <div style={{ color: 'var(--accent-2)', fontSize: 13, marginBottom: 10 }}>{msg}</div>}

        <div>
          {imports.length === 0 ? (
            <div className="empty">No imported sources. The bundled SRD is always available.</div>
          ) : (
            imports.map((src) => {
              const counts = Object.entries(src.counts)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => `${n} ${k}`)
                .join(', ');
              return (
                <div className="source-item" key={src.id}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {src.name}{' '}
                      <span className="badge import">{src.format === 'fightclub-xml' ? 'XML' : 'JSON'}</span>
                    </div>
                    <div className="meta" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                      {counts || 'empty'}
                    </div>
                  </div>
                  <button className="btn sm ghost" onClick={() => void removeImport(src.id)}>
                    Remove
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
