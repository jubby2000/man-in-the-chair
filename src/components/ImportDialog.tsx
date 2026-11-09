import { useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import type { ImportStrategy } from '../types';
import { EXAMPLE_JSON, EXAMPLE_XML, downloadText } from '../lib/importExamples';

interface Pending {
  fileName: string;
  text: string;
  total: number;
  duplicates: number;
}

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const imports = useStore((s) => s.imports);
  const importFile = useStore((s) => s.importFile);
  const previewImport = useStore((s) => s.previewImport);
  const removeImport = useStore((s) => s.removeImport);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      // Only handle one file in the prompt flow at a time for a clear decision.
      const file = files[0];
      const text = await file.text();
      const { counts, duplicates } = await previewImport(file.name, text);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (duplicates > 0) {
        setPending({ fileName: file.name, text, total, duplicates });
      } else {
        await doImport(file.name, text, 'merge', total);
      }
    } catch (err) {
      setMsg(`Import failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (fileName: string, text: string, strategy: ImportStrategy, total: number) => {
    setBusy(true);
    try {
      const src = await importFile(fileName, text, strategy);
      const got = Object.values(src.counts).reduce((a, b) => a + b, 0);
      setMsg(`Imported “${src.name}” — ${got} entries (${strategyLabel(strategy)}).`);
      setPending(null);
    } catch (err) {
      setMsg(`Import failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
      void total;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Compendium Sources</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 0 }}>
          Import FightClub5e-compatible <code>.xml</code> or native <code>.json</code>.
          Monsters, spells, items, races, classes, backgrounds, and feats are all read.
          Everything stays in your browser.
        </p>

        <div className="example-row">
          <span className="example-label">Not sure of the format? Grab an example:</span>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => downloadText('man-in-the-chair-example.xml', EXAMPLE_XML, 'application/xml')}
          >
            Example .xml
          </button>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => downloadText('man-in-the-chair-example.json', EXAMPLE_JSON, 'application/json')}
          >
            Example .json
          </button>
        </div>

        {pending ? (
          <div className="dup-prompt">
            <p style={{ fontSize: 14, margin: '4px 0 12px' }}>
              <b>{pending.fileName}</b> has <b>{pending.total}</b> entries, and{' '}
              <b style={{ color: 'var(--warn)' }}>{pending.duplicates}</b> share a name with
              something you already have. How should the overlaps be handled?
            </p>
            <div className="dup-options">
              <button
                className="dup-opt"
                onClick={() => void doImport(pending.fileName, pending.text, 'merge', pending.total)}
              >
                <b>Merge</b>
                <span>One entry per name; imported fields fill in / override, tagged as combined.</span>
              </button>
              <button
                className="dup-opt"
                onClick={() => void doImport(pending.fileName, pending.text, 'replace', pending.total)}
              >
                <b>Replace</b>
                <span>Imported entry wins and fully replaces the existing one.</span>
              </button>
              <button
                className="dup-opt"
                onClick={() => void doImport(pending.fileName, pending.text, 'keep-both', pending.total)}
              >
                <b>Keep both</b>
                <span>Adds a second entry (e.g. “Bronze Dragon” appears twice).</span>
              </button>
            </div>
            <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
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
            {busy ? 'Importing…' : 'Drop a file here, or click to choose'}
            <input
              ref={fileInput}
              type="file"
              accept=".xml,.json"
              style={{ display: 'none' }}
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>
        )}

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
                      <span className="badge import">
                        {src.format === 'fightclub-xml' ? 'XML' : 'JSON'}
                      </span>{' '}
                      <span className="badge">{strategyLabel(src.strategy)}</span>
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

function strategyLabel(s: ImportStrategy): string {
  return s === 'merge' ? 'merged' : s === 'replace' ? 'replaced' : 'kept both';
}
