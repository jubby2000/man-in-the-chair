import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import type { PanelComponentProps } from '../types';
import { getKV, setKV } from '../lib/db';

// Only allow http(s) embeds; reject javascript:, data:, etc.
function safeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function EmbedPanel({ onClose }: PanelComponentProps) {
  const [url, setUrl] = useState('');
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getKV<string>('embedUrl', '').then((v) => {
      setUrl(v);
      setDraft(v);
      setLoaded(true);
    });
  }, []);

  const apply = () => {
    const safe = safeUrl(draft);
    if (safe === null && draft.trim()) return; // invalid; keep editing
    const value = safe ?? '';
    setUrl(value);
    void setKV('embedUrl', value);
  };

  const invalid = draft.trim() !== '' && safeUrl(draft) === null;
  const src = safeUrl(url);

  return (
    <Panel
      onClose={onClose}
      title="Embed"
      flush
      tools={
        url ? (
          <button className="btn sm ghost" onClick={() => { setUrl(''); setDraft(''); void setKV('embedUrl', ''); }}>
            Change
          </button>
        ) : null
      }
    >
      {!loaded ? null : src ? (
        <iframe
          className="embed-frame"
          src={src}
          title="Custom embed"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          allow="autoplay; fullscreen; clipboard-write; encrypted-media"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="embed-setup">
          <p className="embed-help">
            Paste a web address to embed — a music playlist (Spotify, YouTube), a battle map
            (Owlbear Rodeo), or any page that allows embedding. It runs isolated in its own frame.
          </p>
          <div className="embed-input">
            <input
              className="input"
              placeholder="https://…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
            />
            <button className="btn primary" onClick={apply} disabled={!draft.trim() || invalid}>
              Embed
            </button>
          </div>
          {invalid && <div className="embed-error">Enter a valid http(s) URL.</div>}
          <p className="embed-note">
            Note: some sites refuse to be embedded (they set X-Frame-Options). If the frame stays
            blank, that site doesn't allow embedding.
          </p>
        </div>
      )}
    </Panel>
  );
}
