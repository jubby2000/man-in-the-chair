// Dice-impact sounds via the Web Audio API.
//
// Primary path: a real recording of dice on a table (src/assets/dice-roll.mp3,
// "dice" by freesound_community via Pixabay — Pixabay Content License, free for
// commercial use, no attribution required). The clip contains ~10 distinct
// impacts; we slice it into per-impact GRAINS and play one grain per physics
// collision, picked by impact strength. That keeps the sound synced to what the
// dice actually do instead of playing a fixed canned roll.
//
// Fallback: the synthesized click/thock below, used until the sample decodes
// (or if decoding fails). The asset is bundled and precached, so it's offline.

import diceSampleUrl from '../assets/dice-roll.mp3';

let ctx: AudioContext | null = null;
let muted = false;
let lastPlay = 0;

export function setDiceMuted(value: boolean) {
  muted = value;
}
export function isDiceMuted() {
  return muted;
}

function ensureContext(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  void loadSample(ctx);
  return ctx;
}

// ---- Sampled grains ----

// Impact onsets (seconds) measured from the recording's amplitude envelope,
// bucketed by loudness. Each grain runs from just before its onset to just
// before the next impact so grains never contain a second hit.
const GRAINS: Record<'hard' | 'medium' | 'soft', { at: number; dur: number }[]> = {
  hard: [
    { at: 0.088, dur: 0.11 },
    { at: 0.209, dur: 0.085 },
    { at: 0.299, dur: 0.06 },
    { at: 0.419, dur: 0.05 },
  ],
  medium: [
    { at: 0.359, dur: 0.055 },
    { at: 0.469, dur: 0.045 },
    { at: 0.514, dur: 0.06 },
  ],
  soft: [
    { at: 0.584, dur: 0.022 },
    { at: 0.604, dur: 0.032 },
    { at: 0.636, dur: 0.06 },
  ],
};

let sample: AudioBuffer | null = null;
let sampleLoading: Promise<void> | null = null;

function loadSample(audio: AudioContext): Promise<void> {
  if (sample || sampleLoading) return sampleLoading ?? Promise.resolve();
  sampleLoading = fetch(diceSampleUrl)
    .then((r) => r.arrayBuffer())
    .then((buf) => audio.decodeAudioData(buf))
    .then((decoded) => {
      sample = decoded;
    })
    .catch(() => {
      // keep the synth fallback; allow a later retry
      sampleLoading = null;
    });
  return sampleLoading;
}

/** Warm the decoder ahead of the first collision (call when a roll starts). */
export function preloadDiceSound() {
  ensureContext();
}

let lastGrain = -1;
function playGrain(audio: AudioContext, buffer: AudioBuffer, s: number) {
  const bucket = s > 0.6 ? GRAINS.hard : s > 0.3 ? GRAINS.medium : GRAINS.soft;
  // avoid repeating the exact same grain back-to-back (sounds mechanical)
  let idx = Math.floor(Math.random() * bucket.length);
  if (bucket.length > 1 && idx === lastGrain) idx = (idx + 1) % bucket.length;
  lastGrain = idx;
  const g = bucket[idx];

  const t = audio.currentTime;
  const src = audio.createBufferSource();
  src.buffer = buffer;
  // slight pitch/speed variation so a pile of dice doesn't sound looped
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const gain = audio.createGain();
  const peak = 0.25 + s * 0.75;
  const dur = g.dur / src.playbackRate.value;
  gain.gain.setValueAtTime(peak, t);
  // short fade-out at the grain tail to avoid a click at the cut point
  gain.gain.setValueAtTime(peak, t + dur * 0.7);
  gain.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(gain).connect(audio.destination);
  src.start(t, g.at, g.dur);
}

// A very short noise buffer used as the "click" attack. Regenerated once.
let clickBuffer: AudioBuffer | null = null;
function getClickBuffer(audio: AudioContext): AudioBuffer {
  if (clickBuffer) return clickBuffer;
  const len = Math.floor(audio.sampleRate * 0.02); // 20ms
  const buf = audio.createBuffer(1, len, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    // fast exponential decay -> a tight tick, not a rustle
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  }
  clickBuffer = buf;
  return buf;
}

/**
 * Play one impact. `strength` ~0..1 scales volume and brightness.
 * `surface` picks the timbre:
 *  - 'table': die hitting the tray floor/walls -> a grain of the real recording
 *  - 'die':   die hitting another die -> the synthesized plastic click below
 *             (bright click + short "thock"), which reads as dice ticking
 *             against each other rather than landing on wood.
 * Each surface is rate-limited separately so piles of contacts don't buzz,
 * and a die-die click never swallows a table hit (or vice versa).
 */
let lastDiePlay = 0;
export function playClack(strength = 0.5, surface: 'table' | 'die' = 'table') {
  const audio = ensureContext();
  if (!audio) return;
  const now = performance.now();
  if (surface === 'die') {
    if (now - lastDiePlay < 30) return;
    lastDiePlay = now;
  } else {
    if (now - lastPlay < 22) return;
    lastPlay = now;
  }

  const s = Math.max(0.1, Math.min(1, strength));
  if (surface === 'table' && sample) {
    playGrain(audio, sample, s);
    return;
  }
  // die-on-die clicks sit a little under the table hits in the mix
  const level = surface === 'die' ? 0.6 : 0.9;
  const t = audio.currentTime;
  const out = audio.createGain();
  out.gain.value = level;
  out.connect(audio.destination);

  // --- Layer 1: click transient (plastic) ---
  const click = audio.createBufferSource();
  click.buffer = getClickBuffer(audio);
  const hp = audio.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  const clickGain = audio.createGain();
  const clickPeak = 0.08 + s * 0.3;
  clickGain.gain.setValueAtTime(clickPeak, t);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  click.connect(hp).connect(clickGain).connect(out);
  click.start(t);
  click.stop(t + 0.035);

  // --- Layer 2: woody resonant body (short pitched thock) ---
  const osc = audio.createOscillator();
  osc.type = 'triangle';
  const baseFreq = 220 + s * 120; // harder hits ring a touch higher
  osc.frequency.setValueAtTime(baseFreq * 1.6, t);
  osc.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.02);
  const bp = audio.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = baseFreq * 2;
  bp.Q.value = 3.5;
  const bodyGain = audio.createGain();
  const bodyPeak = 0.05 + s * 0.14;
  bodyGain.gain.setValueAtTime(0, t);
  bodyGain.gain.linearRampToValueAtTime(bodyPeak, t + 0.002);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  osc.connect(bp).connect(bodyGain).connect(out);
  osc.start(t);
  osc.stop(t + 0.08);
}
