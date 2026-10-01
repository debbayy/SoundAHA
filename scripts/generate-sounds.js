// Generates the original, royalty-free default sounds into assets/sounds/*.wav
// Run: node scripts/generate-sounds.js
const fs = require('fs');
const path = require('path');

const SR = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');
const TAU = Math.PI * 2;

const buf = (sec) => new Float32Array(Math.floor(sec * SR));
const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t / d);
let seed = 1337;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

function normalize(b, peak = 0.9) {
  let m = 0;
  for (const v of b) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < b.length; i++) b[i] = (b[i] / m) * peak;
  return b;
}

function writeWav(name, b) {
  const data = Buffer.alloc(b.length * 2);
  for (let i = 0; i < b.length; i++) data.writeInt16LE(Math.max(-1, Math.min(1, b[i])) * 32767, i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, name), Buffer.concat([h, data]));
  console.log(name, (b.length / SR).toFixed(1) + 's', Math.round((44 + data.length) / 1024) + 'KB');
}

// Low, falling "bruh"-like groan: pitch glide with vibrato + harmonics.
function bruh() {
  const b = buf(1.1);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = 190 - 90 * (t / 1.1) + 6 * Math.sin(TAU * 6 * t);
    ph += (TAU * f) / SR;
    const s = Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph);
    b[i] = s * Math.min(1, t / 0.03) * Math.min(1, (1.1 - t) / 0.25);
  }
  return normalize(b);
}

// Deep impact boom: fast-falling sub sine + noise burst.
function boom() {
  const b = buf(2);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (TAU * (45 + 120 * Math.exp(-t * 14))) / SR;
    b[i] = Math.sin(ph) * env(t, 0.003, 0.45) * 1.2 + rnd() * env(t, 0.001, 0.05) * 0.5;
  }
  return normalize(b);
}

// "Ha ha ha": voiced bursts with decreasing pitch.
function laugh() {
  const b = buf(2.4);
  for (let k = 0; k < 6; k++) {
    const start = 0.1 + k * 0.34;
    const base = 300 - k * 18;
    let ph = 0;
    for (let i = Math.floor(start * SR); i < Math.floor((start + 0.24) * SR) && i < b.length; i++) {
      const t = i / SR - start;
      ph += (TAU * (base - 60 * t)) / SR;
      const s = Math.sin(ph) + 0.6 * Math.sin(2 * ph) + 0.35 * Math.sin(3 * ph) + 0.1 * rnd();
      b[i] += s * Math.sin((Math.PI * t) / 0.24) * (1 - k * 0.08);
    }
  }
  return normalize(b);
}

// Crowd applause: dense random claps (short noise ticks) with swelling envelope.
function applause() {
  const sec = 4;
  const b = buf(sec);
  const claps = 1100;
  for (let c = 0; c < claps; c++) {
    const t0 = Math.abs(rnd()) * (sec - 0.05);
    const swell = Math.min(1, t0 / 0.5) * Math.min(1, (sec - t0) / 1.2);
    if (Math.abs(rnd()) > swell) continue;
    const amp = 0.3 + Math.abs(rnd());
    let lp = 0;
    for (let i = 0; i < 400; i++) {
      const idx = Math.floor(t0 * SR) + i;
      if (idx >= b.length) break;
      lp += (rnd() - lp) * 0.6;
      b[idx] += lp * amp * Math.exp(-i / 60);
    }
  }
  return normalize(b);
}

// Calm looping pad: Am7 -> Fmaj7 -> Cmaj7 -> G, soft sines + slow tremolo.
function chill() {
  const chords = [
    [220, 261.63, 329.63, 392],
    [174.61, 220, 261.63, 329.63],
    [130.81, 196, 246.94, 329.63],
    [196, 246.94, 293.66, 392],
  ];
  const seg = 4;
  const b = buf(seg * chords.length);
  chords.forEach((ch, ci) => {
    for (let i = 0; i < seg * SR; i++) {
      const t = i / SR;
      const e = Math.min(1, t / 0.8) * Math.min(1, (seg - t) / 0.8);
      let s = 0;
      for (const f of ch) s += Math.sin(TAU * f * t) + 0.2 * Math.sin(TAU * f * 2 * t);
      b[ci * seg * SR + i] = s * e * (0.8 + 0.2 * Math.sin(TAU * 0.5 * t));
    }
  });
  return normalize(b, 0.6);
}

fs.mkdirSync(OUT, { recursive: true });
writeWav('bruh.wav', bruh());
writeWav('vine-boom.wav', boom());
writeWav('laugh-track.wav', laugh());
writeWav('applause.wav', applause());
writeWav('chill-loop.wav', chill());
