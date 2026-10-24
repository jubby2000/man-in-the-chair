// Synthesized dice-impact sounds via the Web Audio API. No audio files.
// Target timbre: hard plastic on wood — a sharp, short click transient plus a
// brief woody resonance, not a soft papery rustle. Fully offline, zero download.

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
  return ctx;
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
 * Two layers: a bright filtered click (plastic surface) + a short triangle
 * "thock" (wood body). Rate-limited so piles of contacts don't buzz.
 */
export function playClack(strength = 0.5) {
  const audio = ensureContext();
  if (!audio) return;
  const now = performance.now();
  if (now - lastPlay < 22) return;
  lastPlay = now;

  const s = Math.max(0.1, Math.min(1, strength));
  const t = audio.currentTime;
  const out = audio.createGain();
  out.gain.value = 0.9;
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
