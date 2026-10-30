import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import type { PanelComponentProps } from '../types';
import { NumberInput } from '../components/NumberInput';
import { useTimerStore, countdownLeft, stopwatchElapsed } from '../store/useTimerStore';

const fmt = (totalSec: number): string => {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

export function TimerPanel({ onClose }: PanelComponentProps) {
  const t = useTimerStore();
  const { view: mode, countdown: cd, stopwatch: sw } = t;

  const cdRunning = cd.endAt !== null;
  const swRunning = sw.startedAt !== null;

  // Re-render a few times a second while either clock is running. The clocks
  // themselves live in the store (they keep going with this panel closed).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!cdRunning && !swRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [cdRunning, swRunning]);

  const cdLeft = countdownLeft(cd, now);
  const swElapsed = stopwatchElapsed(sw, now);

  const running = mode === 'countdown' ? cdRunning : swRunning;
  const shown = mode === 'countdown' ? cdLeft : swElapsed;
  const done = mode === 'countdown' && cd.done;
  const low = mode === 'countdown' && cdLeft <= 10 && cdLeft > 0 && cdRunning;

  const start = mode === 'countdown' ? t.startCountdown : t.startStopwatch;
  const pause = mode === 'countdown' ? t.pauseCountdown : t.pauseStopwatch;
  const reset = mode === 'countdown' ? t.resetCountdown : t.resetStopwatch;

  // What the tab you are NOT looking at is doing, so it is never out of sight.
  const hiddenChip = (which: 'countdown' | 'stopwatch') => {
    if (mode === which) return null;
    if (which === 'countdown') {
      if (cd.done) return <span className="timer-chip done">Time’s up</span>;
      if (cdRunning) return <span className="timer-chip">{fmt(cdLeft)}</span>;
      return null;
    }
    return swRunning ? <span className="timer-chip">{fmt(swElapsed)}</span> : null;
  };

  return (
    <Panel
      onClose={onClose}
      title="Timer"
      tools={
        <>
          <button
            className={`btn sm ${mode === 'countdown' ? 'primary' : ''}`}
            onClick={() => t.setView('countdown')}
            title={cdRunning && mode !== 'countdown' ? 'Countdown is still running' : undefined}
          >
            Countdown
            {hiddenChip('countdown')}
          </button>
          <button
            className={`btn sm ${mode === 'stopwatch' ? 'primary' : ''}`}
            onClick={() => t.setView('stopwatch')}
            title={swRunning && mode !== 'stopwatch' ? 'Stopwatch is still running' : undefined}
          >
            Stopwatch
            {hiddenChip('stopwatch')}
          </button>
        </>
      }
    >
      <div className="timer-panel">
        <div className={`timer-display ${done ? 'done' : ''} ${low ? 'low' : ''}`}>
          {fmt(shown)}
        </div>
        {done && <div className="timer-done-label">Time's up</div>}

        {mode === 'countdown' && !running && (
          <div className="timer-set">
            <label>
              Min
              <NumberInput
                className="input"
                min={0}
                value={cd.mins}
                onChange={(e) => t.setPreset(Math.max(0, parseInt(e.target.value, 10) || 0), cd.secs)}
              />
            </label>
            <label>
              Sec
              <NumberInput
                className="input"
                min={0}
                max={59}
                value={cd.secs}
                onChange={(e) =>
                  t.setPreset(cd.mins, Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))
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
              <button key={m} className="btn sm" onClick={() => t.setPreset(m, 0)}>
                {m}m
              </button>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
