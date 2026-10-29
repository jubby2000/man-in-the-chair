import { useEffect, useRef, useState } from 'react';
import { Panel } from '../components/Panel';
import type { PanelComponentProps } from '../types';
import { NumberInput } from '../components/NumberInput';

type Mode = 'countdown' | 'stopwatch';

const fmt = (totalSec: number): string => {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

export function TimerPanel({ onClose }: PanelComponentProps) {
  const [mode, setMode] = useState<Mode>('countdown');
  const [mins, setMins] = useState(5);
  const [secs, setSecs] = useState(0);
  const [remaining, setRemaining] = useState(5 * 60); // seconds (countdown) / elapsed (stopwatch)
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const tick = useRef<number | null>(null);

  // drive the clock while running
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const base = remaining;
    tick.current = window.setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      if (mode === 'countdown') {
        const left = base - elapsed;
        if (left <= 0) {
          setRemaining(0);
          setRunning(false);
          setDone(true);
        } else {
          setRemaining(left);
        }
      } else {
        setRemaining(base + elapsed);
      }
    }, 200);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode]);

  const start = () => {
    if (mode === 'countdown' && remaining <= 0) reset();
    setDone(false);
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    setDone(false);
    setRemaining(mode === 'countdown' ? mins * 60 + secs : 0);
  };

  // when the user edits the preset or switches mode while stopped, resync
  useEffect(() => {
    if (!running) setRemaining(mode === 'countdown' ? mins * 60 + secs : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mins, secs, mode]);

  const low = mode === 'countdown' && remaining <= 10 && remaining > 0;

  return (
    <Panel
      onClose={onClose}
      title="Timer"
      tools={
        <>
          <button
            className={`btn sm ${mode === 'countdown' ? 'primary' : ''}`}
            onClick={() => setMode('countdown')}
          >
            Countdown
          </button>
          <button
            className={`btn sm ${mode === 'stopwatch' ? 'primary' : ''}`}
            onClick={() => setMode('stopwatch')}
          >
            Stopwatch
          </button>
        </>
      }
    >
      <div className="timer-panel">
        <div className={`timer-display ${done ? 'done' : ''} ${low ? 'low' : ''}`}>
          {fmt(remaining)}
        </div>
        {done && <div className="timer-done-label">Time's up</div>}

        {mode === 'countdown' && !running && (
          <div className="timer-set">
            <label>
              Min
              <NumberInput
                className="input"
                min={0}
                value={mins}
                onChange={(e) => setMins(Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
            </label>
            <label>
              Sec
              <NumberInput
                className="input"
                min={0}
                max={59}
                value={secs}
                onChange={(e) =>
                  setSecs(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))
                }
              />
            </label>
          </div>
        )}

        <div className="timer-controls">
          {running ? (
            <button className="btn primary" onClick={pause}>Pause</button>
          ) : (
            <button className="btn primary" onClick={start}>Start</button>
          )}
          <button className="btn ghost" onClick={reset}>Reset</button>
        </div>

        {mode === 'countdown' && !running && (
          <div className="timer-quick">
            {[1, 5, 10, 30].map((m) => (
              <button
                key={m}
                className="btn sm"
                onClick={() => {
                  setMins(m);
                  setSecs(0);
                }}
              >
                {m}m
              </button>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
