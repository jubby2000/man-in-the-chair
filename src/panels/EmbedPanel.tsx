import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import type { PanelComponentProps } from '../types';
import { getKV, setKV } from '../lib/db';

// Accept either a raw http(s) URL or a full embed <iframe …> snippet (what
// YouTube/Spotify/etc. hand you from their Share → Embed button). Returns the
// validated http(s) src, or null if neither yields a safe URL.
function resolveEmbedSrc(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // If it looks like an <iframe> tag, pull the src attribute out of it.
  let candidate = trimmed;
  if (/<iframe[\s>]/i.test(trimmed)) {
    const m = trimmed.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!m) return null;
    candidate = m[1].trim();
  }

  try {
    const u = new URL(candidate);
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
    const safe = resolveEmbedSrc(draft);
    if (safe === null && draft.trim()) return; // invalid; keep editing
    const value = safe ?? '';
    setUrl(value);
    setDraft(value); // normalize the field to the extracted URL
    void setKV('embedUrl', value);
  };

  const invalid = draft.trim() !== '' && resolveEmbedSrc(draft) === null;
  const src = resolveEmbedSrc(url);

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
            Paste a web address <em>or</em> a full embed code (the{' '}
            <code>&lt;iframe&gt;</code> snippet from a site's “Share → Embed”) — a music playlist
            (Spotify, YouTube), a battle map (Owlbear Rodeo), or any page that allows embedding. It
            runs isolated in its own frame.
          </p>
          <div className="embed-input">
            <textarea
              className="embed-textarea"
              placeholder={'https://…\n\nor paste a full <iframe …> embed snippet'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) apply();
              }}
            />
            <button className="btn primary" onClick={apply} disabled={!draft.trim() || invalid}>
              Embed
            </button>
          </div>
          {invalid && <div className="embed-error">Enter a valid http(s) URL or embed snippet.</div>}
          <p className="embed-note">
            Note: some sites refuse to be embedded (they set X-Frame-Options). If the frame stays
            blank, that site doesn't allow embedding.
          </p>
        </div>
      )}
    </Panel>
  );
}
