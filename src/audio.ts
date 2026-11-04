// All sounds are generated in code with Web Audio (no sound files).

let ctx: AudioContext | null = null;
let master: GainNode;
let sizzleGain: GainNode;
let enabled = true;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  // Grill sizzle: crackly filtered noise, looped
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const crackle = Math.random() < 0.002 ? (Math.random() * 2 - 1) * 3 : 0;
    d[i] = (Math.random() * 2 - 1) * 0.5 + crackle;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 2200;
  sizzleGain = ctx.createGain(); sizzleGain.gain.value = 0;
  src.connect(hp).connect(sizzleGain).connect(master);
  src.start();
}

export function setAudioEnabled(on: boolean) {
  enabled = on;
  if (sizzleGain && !on) sizzleGain.gain.value = 0;
}

/** n = number of sausages on the grill */
export function setSizzle(n: number) {
  if (!ctx || !enabled) return;
  sizzleGain.gain.setTargetAtTime(Math.min(n, 3) * 0.05, ctx.currentTime, 0.15);
}

function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine', dest?: AudioNode) {
  if (!ctx || !enabled) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
  o.connect(g).connect(dest ?? master);
  o.start(start); o.stop(start + dur + 0.05);
}

export function pop() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.07);
  g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  if (!enabled) return;
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.15);
}

export function squirt() {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.18);
  g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.22);
}

export function coin(pitch = 1) {
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(1318 * pitch, t, 0.12, 0.14, 'square');
  tone(1975 * pitch, t + 0.07, 0.35, 0.12, 'square');
}

export function ding() {
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(1568, t, 0.6, 0.16);
  tone(2093, t + 0.04, 0.5, 0.1);
}

export function buzz() {
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(110, t, 0.25, 0.12, 'sawtooth');
  tone(98, t + 0.12, 0.3, 0.12, 'sawtooth');
}

export function fanfare() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [523.3, 659.3, 784, 1046.5, 784, 1046.5].forEach((f, i) => {
    tone(f, t + i * 0.1, 0.45, 0.15, 'triangle');
    tone(f / 2, t + i * 0.1, 0.3, 0.06);
  });
}

export function click() {
  if (!ctx) return;
  tone(880, ctx.currentTime, 0.08, 0.07, 'square');
}

// ---------- Music: light swing groove (walking bass + muted chords + brush hats) ----------
let musicGain: GainNode | null = null;
let musicOn = false;
let musicTimer: ReturnType<typeof setInterval> | undefined;
let nextBeat = 0, step = 0;
const BPM = 112;
// ii-V-I-VI in C: Dm7 G7 Cmaj7 A7 (one bar each, 4 beats)
const CHORDS = [
  [293.7, 349.2, 440, 523.3], [392, 493.9, 587.3, 698.5],
  [261.6, 329.6, 392, 493.9], [220, 277.2, 329.6, 392],
];
const BASS = [
  [73.4, 87.3, 110, 103.8], [98, 123.5, 146.8, 138.6],
  [65.4, 82.4, 98, 110], [110, 92.5, 82.4, 77.8],
];
let nb: AudioBuffer | null = null;

function hat(t: number, vol: number) {
  const s = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  s.buffer = nb!; f.type = 'highpass'; f.frequency.value = 6000;
  g.gain.value = vol;
  s.connect(f).connect(g).connect(musicGain!); s.start(t);
}

function schedule() {
  if (!ctx || !musicGain) return;
  const beat = 60 / BPM;
  while (nextBeat < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 4) % 4, b = step % 4;
    tone(BASS[bar][b], nextBeat, beat * 0.9, 0.32, 'triangle', musicGain);
    if (b === 1 || b === 3) {
      for (const f of CHORDS[bar]) tone(f, nextBeat, 0.18, 0.035, 'square', musicGain);
    }
    hat(nextBeat, 0.12);
    hat(nextBeat + beat * 0.66, 0.07);   // swung offbeat
    nextBeat += beat; step++;
  }
}

export function setMusic(on: boolean) {
  musicOn = on;
  if (!ctx) return;
  if (!musicGain) {
    musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
    const b = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
    nb = b;
  }
  musicGain.gain.setTargetAtTime(on ? 0.35 : 0, ctx.currentTime, 0.3);
  clearInterval(musicTimer);
  if (on) {
    nextBeat = ctx.currentTime + 0.1;
    musicTimer = setInterval(schedule, 100);
  }
}
export const musicEnabled = () => musicOn;
