import { create } from 'zustand';
import { useStore } from './useStore';

/**
 * The Timer panel's two clocks live here, outside the panel, so that:
 *  - the countdown and the stopwatch are independent (both can run at once);
 *  - switching between them, or switching layout tabs (which unmounts the
 *    panel), never stops or alters either one.
 *
 * Running clocks store a timestamp (end time / start time) rather than a
 * ticking counter, so the value is always derivable from the clock. State is
 * kept for the life of the page; a reload resets it.
 */

export type TimerMode = 'countdown' | 'stopwatch';

interface Countdown {
  mins: number;
  secs: number;
  /** Seconds left while not running (idle or paused). */
  remaining: number;
  /** When running: the epoch ms at which it reaches zero. */
  endAt: number | null;
  done: boolean;
}

interface Stopwatch {
  /** Seconds accumulated before the current run. */
  elapsed: number;
  /** When running: the epoch ms the current run started. */
  startedAt: number | null;
}

interface TimerState {
  view: TimerMode;
  countdown: Countdown;
  stopwatch: Stopwatch;
  setView: (v: TimerMode) => void;
  setPreset: (mins: number, secs: number) => void;
  startCountdown: () => void;
  pauseCountdown: () => void;
  resetCountdown: () => void;
  startStopwatch: () => void;
  pauseStopwatch: () => void;
  resetStopwatch: () => void;
}

/** Seconds left on the countdown at `now`. */
export const countdownLeft = (c: Countdown, now: number): number =>
  c.endAt !== null ? Math.max(0, (c.endAt - now) / 1000) : c.remaining;

/** Seconds elapsed on the stopwatch at `now`. */
export const stopwatchElapsed = (s: Stopwatch, now: number): number =>
  s.startedAt !== null ? s.elapsed + (now - s.startedAt) / 1000 : s.elapsed;

let expiryTimer: number | null = null;
const clearExpiry = () => {
  if (expiryTimer !== null) {
    window.clearTimeout(expiryTimer);
    expiryTimer = null;
  }
};

export const useTimerStore = create<TimerState>((set, get) => {
  /** Fires even while the panel is closed or on another layout tab. */
  const scheduleExpiry = (endAt: number) => {
    clearExpiry();
    expiryTimer = window.setTimeout(() => {
      expiryTimer = null;
      const c = get().countdown;
      if (c.endAt === null || c.endAt > Date.now() + 50) return; // paused/reset/restarted since
      set({ countdown: { ...c, endAt: null, remaining: 0, done: true } });
      useStore.getState().showToast('Timer: time’s up');
    }, Math.max(0, endAt - Date.now()));
  };

  const idleSeconds = (c: Countdown) => c.mins * 60 + c.secs;

  return {
    view: 'countdown',
    countdown: { mins: 5, secs: 0, remaining: 5 * 60, endAt: null, done: false },
    stopwatch: { elapsed: 0, startedAt: null },

    setView: (view) => set({ view }),

    setPreset: (mins, secs) =>
      set((s) =>
        s.countdown.endAt !== null
          ? s // can't edit while running
          : { countdown: { ...s.countdown, mins, secs, remaining: mins * 60 + secs, done: false } },
      ),

    startCountdown: () => {
      const c = get().countdown;
      if (c.endAt !== null) return;
      const left = c.done || c.remaining <= 0 ? idleSeconds(c) : c.remaining;
      if (left <= 0) return;
      const endAt = Date.now() + left * 1000;
      set({ countdown: { ...c, endAt, remaining: left, done: false } });
      scheduleExpiry(endAt);
    },

    pauseCountdown: () => {
      const c = get().countdown;
      if (c.endAt === null) return;
      clearExpiry();
      set({ countdown: { ...c, remaining: countdownLeft(c, Date.now()), endAt: null } });
    },

    resetCountdown: () => {
      clearExpiry();
      const c = get().countdown;
      set({ countdown: { ...c, endAt: null, done: false, remaining: idleSeconds(c) } });
    },

    startStopwatch: () => {
      const s = get().stopwatch;
      if (s.startedAt !== null) return;
      set({ stopwatch: { ...s, startedAt: Date.now() } });
    },

    pauseStopwatch: () => {
      const s = get().stopwatch;
      if (s.startedAt === null) return;
      set({ stopwatch: { elapsed: stopwatchElapsed(s, Date.now()), startedAt: null } });
    },

    resetStopwatch: () => set({ stopwatch: { elapsed: 0, startedAt: null } }),
  };
});
