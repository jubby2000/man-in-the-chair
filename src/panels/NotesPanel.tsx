import { useEffect, useRef, useState } from 'react';
import { Panel } from '../components/Panel';
import type { PanelComponentProps } from '../types';
import { getKV, setKV } from '../lib/db';
import { useStore } from '../store/useStore';
import { buildRecap, logIcon, logTime } from '../lib/recap';

export function NotesPanel({ onClose }: PanelComponentProps) {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [quick, setQuick] = useState('');
  const [copied, setCopied] = useState(false);
  const notesRevision = useStore((s) => s.notesRevision);
  const sessionLog = useStore((s) => s.sessionLog);
  const addLogNote = useStore((s) => s.addLogNote);
  const clearSessionLog = useStore((s) => s.clearSessionLog);
  const confirm = useStore((s) => s.confirm);
  const showToast = useStore((s) => s.showToast);
  const feedRef = useRef<HTMLDivElement>(null);

  // (re)load from storage on mount and whenever an external append bumps the revision
  useEffect(() => {
    getKV<string>('notes', '').then((v) => {
      setText(v);
      setLoaded(true);
    });
  }, [notesRevision]);

  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => void setKV('notes', text), 400);
    return () => clearTimeout(id);
  }, [text, loaded]);

  // keep the feed scrolled to the latest beat as events come in
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sessionLog.length]);

  const addQuick = () => {
    const t = quick.trim();
    if (!t) return;
    addLogNote(t);
    setQuick('');
  };

  const copyRecap = async () => {
    const md = buildRecap(sessionLog, text);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      showToast('Recap copied as Markdown');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast('Copy failed — clipboard unavailable');
    }
  };

  const clearLog = async () => {
    if (sessionLog.length === 0) return;
    const ok = await confirm({
      title: 'Clear session log?',
      message: 'This removes all logged beats and manual log notes for this session. Your free-text notes below are untouched.',
      confirmLabel: 'Clear log',
      danger: true,
    });
    if (ok) await clearSessionLog();
  };

  return (
    <Panel
      onClose={onClose}
      title="Notes"
      flush
      tools={
        <>
          <button className="btn sm" onClick={copyRecap} title="Copy a Markdown recap to paste into your own notes app">
            {copied ? 'Copied ✓' : 'Copy recap'}
          </button>
          <button className="btn sm ghost" onClick={clearLog} title="Clear the session log">
            Clear log
          </button>
        </>
      }
    >
      <div className="notes-layout">
        <div className="session-log">
          <div className="section-label">Session log</div>
          <div className="log-feed" ref={feedRef}>
            {sessionLog.length === 0 ? (
              <div className="empty">
                Combat beats log here automatically — start, rounds, and when someone drops. Jot
                table moments below; "Copy recap" exports it all as Markdown.
              </div>
            ) : (
              sessionLog.map((e) => (
                <div key={e.id} className={`log-row ${e.kind}`}>
                  <span className="log-time">{logTime(e.at)}</span>
                  <span className="log-icon">{logIcon(e)}</span>
                  <span className="log-text">{e.text}</span>
                </div>
              ))
            )}
          </div>
          <div className="log-input">
            <input
              className="input"
              placeholder="Log a table moment… (party killed the innkeeper)"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addQuick();
              }}
            />
            <button className="btn sm" onClick={addQuick}>
              Log
            </button>
          </div>
        </div>

        <div className="scratch">
          <div className="section-label">Scratchpad</div>
          <textarea
            className="notes-area"
            placeholder="Free-form notes, secret doors, that NPC's accent… (included in the recap)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </div>
    </Panel>
  );
}
