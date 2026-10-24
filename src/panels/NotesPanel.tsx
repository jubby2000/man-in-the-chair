import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import { getKV, setKV } from '../lib/db';

export function NotesPanel() {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getKV<string>('notes', '').then((v) => {
      setText(v);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => void setKV('notes', text), 400);
    return () => clearTimeout(id);
  }, [text, loaded]);

  return (
    <Panel title="Notes" flush>
      <textarea
        className="notes-area"
        placeholder="Session notes, secret doors, that NPC's accent…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </Panel>
  );
}
