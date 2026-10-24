// Synthesized dice-impact sounds via the Web Audio API. No audio files — a
// short noise burst through a band-pass filter reads as a die "clack", pitched
// by impact strength. Fully offline, zero download. Lazily creates the
// AudioContext on first use (after a user gesture, which a roll always is).

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
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
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  if (!noiseBuffer) {
    const len = Math.floor(ctx.sampleRate * 0.08);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      // decaying white noise
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
  }
  return ctx;
}

/**
 * Play one impact. `strength` in ~0..1 scales volume and brightness.
 * Rate-limited so a pile of simultaneous contacts doesn't machine-gun.
 */
export function playClack(strength = 0.5) {
  const audio = ensureContext();
  if (!audio || !noiseBuffer) return;
  const now = performance.now();
  if (now - lastPlay < 18) return; // ~55 hits/sec ceiling
  lastPlay = now;

  const s = Math.max(0.08, Math.min(1, strength));
  const src = audio.createBufferSource();
  src.buffer = noiseBuffer;

  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200 + s * 2600; // harder hits sound brighter
  filter.Q.value = 1.1;

  const gain = audio.createGain();
  const t = audio.currentTime;
  const peak = 0.06 + s * 0.22;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

  src.connect(filter).connect(gain).connect(audio.destination);
  src.start(t);
  src.stop(t + 0.1);
}
