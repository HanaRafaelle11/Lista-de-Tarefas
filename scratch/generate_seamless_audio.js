/**
 * Seamless Audio Generator - MyFlowDay
 * Regenerates WAV assets with crossfaded seamless loops.
 */

import fs from 'fs';
import path from 'path';

const SAMPLE_RATE = 22050;
const DURATION = 60;
const CHANNELS = 1;
const BITS = 16;
const TOTAL_SAMPLES = SAMPLE_RATE * DURATION;
const OUT_DIR = path.resolve('public/assets/audio');

function writeWavHeader(buffer, numSamples) {
  const dataBytes = numSamples * CHANNELS * (BITS / 8);
  let offset = 0;
  const w = (v, n) => {
    if (n === 2) { buffer.writeUInt16LE(v, offset); }
    else         { buffer.writeUInt32LE(v, offset); }
    offset += n;
  };
  const ws = (s) => { buffer.write(s, offset, 'ascii'); offset += s.length; };

  ws('RIFF');
  w(36 + dataBytes, 4);
  ws('WAVE');
  ws('fmt ');
  w(16, 4);
  w(1, 2);
  w(CHANNELS, 2);
  w(SAMPLE_RATE, 4);
  w(SAMPLE_RATE * CHANNELS * (BITS / 8), 4);
  w(CHANNELS * (BITS / 8), 2);
  w(BITS, 2);
  ws('data');
  w(dataBytes, 4);
}

function writeSamples(buffer, samples) {
  const headerSize = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16   = Math.round(clamped * 32767);
    buffer.writeInt16LE(int16, headerSize + i * 2);
  }
}

function saveWav(filename, samples) {
  const headerSize = 44;
  const dataBytes  = samples.length * (BITS / 8);
  const buf        = Buffer.alloc(headerSize + dataBytes);
  writeWavHeader(buf, samples.length);
  writeSamples(buf, samples);
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  const kb = (buf.length / 1024).toFixed(1);
  console.log(`  ✅ ${filename} (${kb} KB) - Seamless Loop`);
}

function whiteNoise() { return Math.random() * 2 - 1; }

class PinkNoise {
  constructor() {
    this.b = [0, 0, 0, 0, 0, 0, 0];
  }
  next() {
    const white = whiteNoise();
    this.b[0] = 0.99886 * this.b[0] + white * 0.0555179;
    this.b[1] = 0.99332 * this.b[1] + white * 0.0750759;
    this.b[2] = 0.96900 * this.b[2] + white * 0.1538520;
    this.b[3] = 0.86650 * this.b[3] + white * 0.3104856;
    this.b[4] = 0.55000 * this.b[4] + white * 0.5329522;
    this.b[5] = -0.7616 * this.b[5] - white * 0.0168980;
    const out = this.b[0] + this.b[1] + this.b[2] + this.b[3] +
                this.b[4] + this.b[5] + this.b[6] + white * 0.5362;
    this.b[6] = white * 0.115926;
    return out * 0.11;
  }
}

function lowPassFilter(samples, alpha) {
  const out = new Float32Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    out[i] = out[i - 1] + alpha * (samples[i] - out[i - 1]);
  }
  return out;
}

function normalize(samples, peakAmp = 0.85) {
  const arr = samples instanceof Float32Array ? samples : new Float32Array(samples);
  let peak = 0;
  for (let i = 0; i < arr.length; i++) {
    const abs = Math.abs(arr[i]);
    if (abs > peak) peak = abs;
  }
  if (peak === 0) return arr;
  const scale = peakAmp / peak;
  for (let i = 0; i < arr.length; i++) arr[i] *= scale;
  return arr;
}

/**
 * DSP Crossfade: Blends the end of the audio samples into the start of the audio.
 * When the audio loops from end back to start, it matches perfectly.
 */
function makeSeamlessLoop(samples, crossfadeSecs = 3.0) {
  const crossfadeSamples = Math.floor(crossfadeSecs * SAMPLE_RATE);
  const N = samples.length;
  const out = new Float32Array(N - crossfadeSamples);
  
  for (let i = 0; i < N - crossfadeSamples; i++) {
    out[i] = samples[i];
  }
  
  for (let i = 0; i < crossfadeSamples; i++) {
    const t = i / crossfadeSamples;
    const endVal = samples[N - crossfadeSamples + i];
    const startVal = samples[i];
    // Blend t goes 0 -> 1. At 0 we want 100% endVal, at 1 we want 100% startVal
    out[i] = startVal * t + endVal * (1 - t);
  }
  
  return out;
}

function generateWhiteNoise() {
  console.log('\n🤍 Generating white noise...');
  const samples = new Float32Array(TOTAL_SAMPLES);
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    samples[i] = whiteNoise() * 0.6;
  }
  const filtered = lowPassFilter(samples, 0.4);
  const seamless = makeSeamlessLoop(filtered, 2.0);
  normalize(seamless, 0.72);
  saveWav('white-noise.wav', seamless);
}

function generateRain() {
  console.log('\n🌧️  Generating rain...');
  const samples = new Float32Array(TOTAL_SAMPLES);
  const pink = new PinkNoise();

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const base = pink.next() * 0.8;
    const wave1 = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 5.3);
    const wave2 = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 3.7);
    const intensity = 0.6 + 0.4 * (wave1 * 0.6 + wave2 * 0.4);
    const dropChance = Math.random();
    const drop = dropChance > 0.997 ? whiteNoise() * 0.4 : 0;
    samples[i] = base * intensity + drop;
  }

  const filtered = lowPassFilter(samples, 0.15);
  const seamless = makeSeamlessLoop(filtered, 3.0);
  normalize(seamless, 0.80);
  saveWav('rain.wav', seamless);
}

function generateForest() {
  console.log('\n🌲 Generating forest...');
  const samples = new Float32Array(TOTAL_SAMPLES);
  const pink = new PinkNoise();

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const wind = pink.next() * (0.2 + 0.15 * Math.sin(2 * Math.PI * t / 8.0));
    const cricketFreq = 3900;
    const cricketMod  = 18;
    const cricket = 0.08 * Math.sin(2 * Math.PI * cricketFreq * t)
                        * (0.5 + 0.5 * Math.sin(2 * Math.PI * cricketMod * t));
    const cricket2 = 0.05 * Math.sin(2 * Math.PI * 2200 * t)
                         * (0.5 + 0.5 * Math.sin(2 * Math.PI * 12 * t + 1.3));
    const birdPhase = Math.sin(2 * Math.PI * t / 12.7);
    const bird = birdPhase > 0.997
      ? 0.12 * Math.sin(2 * Math.PI * 2700 * t) * Math.exp(-1.5 * (t % 1))
      : 0;
    const leaves = whiteNoise() * 0.04 * (0.4 + 0.6 * Math.abs(Math.sin(2 * Math.PI * t / 2.1)));
    samples[i] = wind + cricket + cricket2 + bird + leaves;
  }

  const filtered = lowPassFilter(samples, 0.7);
  const seamless = makeSeamlessLoop(filtered, 3.0);
  normalize(seamless, 0.75);
  saveWav('forest.wav', seamless);
}

function generateCafe() {
  console.log('\n☕ Generating cafe...');
  const samples = new Float32Array(TOTAL_SAMPLES);
  const pink = new PinkNoise();
  const voices = Array.from({ length: 8 }, (_, k) => ({
    freq:   180 + k * 47 + Math.random() * 30,
    phase:  Math.random() * Math.PI * 2,
    mod:    0.5 + Math.random() * 1.5,
    amp:    0.04 + Math.random() * 0.04,
    offset: Math.random() * 20,
  }));

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    let murmur = 0;
    for (const v of voices) {
      murmur += v.amp
        * Math.sin(2 * Math.PI * v.freq * t + v.phase)
        * (0.4 + 0.6 * Math.abs(Math.sin(2 * Math.PI * v.mod * (t + v.offset))));
    }
    const ambient = pink.next() * 0.25;
    const clickChance = Math.random();
    const click = clickChance > 0.9998
      ? whiteNoise() * 0.3 * Math.exp(-80 * ((t % (1 / SAMPLE_RATE))))
      : 0;
    const machine = 0.02 * Math.sin(2 * Math.PI * 120 * t)
                       * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / 15.0));
    samples[i] = murmur + ambient + click + machine;
  }

  const filtered = lowPassFilter(samples, 0.3);
  const seamless = makeSeamlessLoop(filtered, 3.0);
  normalize(seamless, 0.78);
  saveWav('cafe.wav', seamless);
}

function generateOcean() {
  console.log('\n🌊 Generating ocean...');
  const samples = new Float32Array(TOTAL_SAMPLES);
  const pink = new PinkNoise();
  const waveParams = [
    { period: 8.5,  amp: 0.55, phase: 0.0 },
    { period: 11.2, amp: 0.30, phase: 2.1 },
    { period: 6.3,  amp: 0.20, phase: 4.5 },
    { period: 14.0, amp: 0.15, phase: 1.0 },
  ];

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    let envelope = 0;
    for (const w of waveParams) {
      const phase  = (t / w.period + w.phase / (2 * Math.PI)) % 1;
      const shape  = phase < 0.6
        ? Math.sin(Math.PI * phase / 0.6)
        : Math.sin(Math.PI * (1 - (phase - 0.6) / 0.4) * 0.5);
      envelope += w.amp * Math.max(0, shape);
    }
    const base  = pink.next();
    const surge = envelope * 1.2;
    const foam  = envelope > 0.5 ? whiteNoise() * (envelope - 0.4) * 0.3 : 0;
    samples[i] = base * (0.25 + 0.75 * surge) + foam;
  }

  const filtered = lowPassFilter(samples, 0.12);
  const seamless = makeSeamlessLoop(filtered, 4.0);
  normalize(seamless, 0.82);
  saveWav('ocean.wav', seamless);
}

function generateFireplace() {
  console.log('\n🔥 Generating fireplace...');
  const samples = new Float32Array(TOTAL_SAMPLES);
  const pink = new PinkNoise();
  let crackleDecay = 0.992;
  let crackleAmp = 0;
  let hissDecay = 0.9995;
  let hissAmp = 0;

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const flameMod = 0.5 + 0.3 * Math.sin(2 * Math.PI * t / 4.1) + 0.2 * Math.sin(2 * Math.PI * t / 1.7);
    const flameBase = pink.next() * (0.35 + 0.15 * Math.sin(2 * Math.PI * flameMod * t));
    if (Math.random() < 0.0002) {
      crackleAmp = 0.6 + Math.random() * 0.4;
      crackleDecay = 0.985 + Math.random() * 0.012;
    }
    let crackle = 0;
    if (crackleAmp > 0.001) {
      crackle = whiteNoise() * crackleAmp;
      crackleAmp *= crackleDecay;
    }
    if (Math.random() < 0.00005) {
      hissAmp = 0.2 + Math.random() * 0.3;
      hissDecay = 0.999 + Math.random() * 0.0008;
    }
    let hiss = 0;
    if (hissAmp > 0.001) {
      hiss = whiteNoise() * hissAmp * (0.4 + 0.6 * Math.sin(2 * Math.PI * 400 * t));
      hissAmp *= hissDecay;
    }
    samples[i] = flameBase + crackle * 0.65 + hiss * 0.15;
  }

  const filtered = lowPassFilter(samples, 0.45);
  const seamless = makeSeamlessLoop(filtered, 3.0);
  normalize(seamless, 0.78);
  saveWav('fireplace.wav', seamless);
}

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  generateWhiteNoise();
  generateRain();
  generateForest();
  generateCafe();
  generateOcean();
  generateFireplace();
  console.log('\n✨ Regenerated loops successfully!');
}

main();
