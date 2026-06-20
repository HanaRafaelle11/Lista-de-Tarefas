/**
 * Gerador de Sons Ambiente — MyFlowDay
 * Gera arquivos .wav sintetizados para cada som ambiente do Modo Foco
 * Executar: node generate-audio.js
 * Saída: public/assets/audio/*.wav
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;   // Hz
const DURATION    = 60;       // segundos (loop de 60s)
const CHANNELS    = 1;        // mono
const BITS        = 16;       // 16-bit PCM

const TOTAL_SAMPLES = SAMPLE_RATE * DURATION;
const OUT_DIR = path.join(__dirname, 'public', 'assets', 'audio');

// ─── Utilitários ──────────────────────────────────────────────────────────────

/** Escreve o cabeçalho WAV no buffer */
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
  w(16, 4);              // Chunk size
  w(1, 2);               // PCM
  w(CHANNELS, 2);
  w(SAMPLE_RATE, 4);
  w(SAMPLE_RATE * CHANNELS * (BITS / 8), 4); // Byte rate
  w(CHANNELS * (BITS / 8), 2);               // Block align
  w(BITS, 2);
  ws('data');
  w(dataBytes, 4);
}

/** Converte amostras float32 [-1, 1] para PCM int16 no buffer */
function writeSamples(buffer, samples) {
  const headerSize = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16   = Math.round(clamped * 32767);
    buffer.writeInt16LE(int16, headerSize + i * 2);
  }
}

/** Salva o arquivo WAV */
function saveWav(filename, samples) {
  const headerSize = 44;
  const dataBytes  = samples.length * (BITS / 8);
  const buf        = Buffer.alloc(headerSize + dataBytes);
  writeWavHeader(buf, samples.length);
  writeSamples(buf, samples);
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  const kb = (buf.length / 1024).toFixed(1);
  console.log(`  ✅ ${filename} (${kb} KB)`);
}

// ─── Geradores de ruído ───────────────────────────────────────────────────────

/** Ruído branco puro */
function whiteNoise() { return Math.random() * 2 - 1; }

/** Ruído rosa (1/f) usando método de Voss-McCartney simplificado */
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

/** Filtro passa-baixa simples (coeficiente alpha) */
function lowPassFilter(samples, alpha) {
  const out = new Float32Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    out[i] = out[i - 1] + alpha * (samples[i] - out[i - 1]);
  }
  return out;
}

/** Normaliza amostras para pico de `peakAmp` */
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

/** Aplica fade-in e fade-out suave (em segundos) para evitar cliques */
function applyFades(samples, fadeSecs = 1.0) {
  const fadeSamples = Math.floor(fadeSecs * SAMPLE_RATE);
  for (let i = 0; i < fadeSamples; i++) {
    const t = i / fadeSamples;
    samples[i] *= t * t;                          // fade-in
    samples[samples.length - 1 - i] *= t * t;    // fade-out
  }
  return samples;
}

// ─── Síntese de cada som ──────────────────────────────────────────────────────

function generateWhiteNoise() {
  console.log('\n🤍 Gerando ruído branco...');
  const samples = new Float32Array(TOTAL_SAMPLES);
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    samples[i] = whiteNoise() * 0.6;
  }
  // Aplica leve filtro passa-baixa para suavizar frequências agudas
  const filtered = lowPassFilter(samples, 0.4);
  applyFades(filtered);
  normalize(filtered, 0.72);
  saveWav('white-noise.wav', filtered);
}

function generateRain() {
  console.log('\n🌧️  Gerando chuva...');
  const samples = new Float32Array(TOTAL_SAMPLES);
  const pink = new PinkNoise();

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;

    // Ruído base (chuva contínua)
    const base = pink.next() * 0.8;

    // Variação de intensidade (rajadas suaves a cada ~3-8s)
    const wave1 = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 5.3);
    const wave2 = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 3.7);
    const intensity = 0.6 + 0.4 * (wave1 * 0.6 + wave2 * 0.4);

    // Gotas aleatórias (impulsos de alta frequência)
    const dropChance = Math.random();
    const drop = dropChance > 0.997 ? whiteNoise() * 0.4 : 0;

    samples[i] = base * intensity + drop;
  }

  // Filtro passa-baixa para dar textura de chuva (não de estática)
  const filtered = lowPassFilter(samples, 0.15);
  applyFades(filtered, 2.0);
  normalize(filtered, 0.80);
  saveWav('rain.wav', filtered);
}

function generateForest() {
  console.log('\n🌲 Gerando floresta...');
  const samples = new Float32Array(TOTAL_SAMPLES);
  const pink = new PinkNoise();

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;

    // Vento de fundo (ruído rosa filtrado)
    const wind = pink.next() * (0.2 + 0.15 * Math.sin(2 * Math.PI * t / 8.0));

    // Grilos (chirp ~3900Hz — seno modulado em amplitude)
    const cricketFreq = 3900;
    const cricketMod  = 18; // Hz de modulação
    const cricket = 0.08 * Math.sin(2 * Math.PI * cricketFreq * t)
                        * (0.5 + 0.5 * Math.sin(2 * Math.PI * cricketMod * t));

    // Grilos mais baixos (~2200Hz)
    const cricket2 = 0.05 * Math.sin(2 * Math.PI * 2200 * t)
                         * (0.5 + 0.5 * Math.sin(2 * Math.PI * 12 * t + 1.3));

    // Pássaro ocasional (chirp alto ~2700Hz, curto)
    const birdPhase = Math.sin(2 * Math.PI * t / 12.7); // a cada ~12.7s
    const bird = birdPhase > 0.997
      ? 0.12 * Math.sin(2 * Math.PI * 2700 * t) * Math.exp(-1.5 * (t % 1))
      : 0;

    // Folhas (ruído de alta frequência suave)
    const leaves = whiteNoise() * 0.04 * (0.4 + 0.6 * Math.abs(Math.sin(2 * Math.PI * t / 2.1)));

    samples[i] = wind + cricket + cricket2 + bird + leaves;
  }

  // Filtro suave para remover frequências extremas
  const filtered = lowPassFilter(samples, 0.7);
  applyFades(filtered, 2.0);
  normalize(filtered, 0.75);
  saveWav('forest.wav', filtered);
}

function generateCafe() {
  console.log('\n☕ Gerando cafeteria...');
  const samples = new Float32Array(TOTAL_SAMPLES);
  const pink = new PinkNoise();

  // Gera "vozes" como somas de senóides moduladas
  const voices = Array.from({ length: 8 }, (_, k) => ({
    freq:   180 + k * 47 + Math.random() * 30,
    phase:  Math.random() * Math.PI * 2,
    mod:    0.5 + Math.random() * 1.5,
    amp:    0.04 + Math.random() * 0.04,
    offset: Math.random() * 20,
  }));

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;

    // Murmúrio de vozes
    let murmur = 0;
    for (const v of voices) {
      murmur += v.amp
        * Math.sin(2 * Math.PI * v.freq * t + v.phase)
        * (0.4 + 0.6 * Math.abs(Math.sin(2 * Math.PI * v.mod * (t + v.offset))));
    }

    // Ruído de fundo (utensílios, música de fundo)
    const ambient = pink.next() * 0.25;

    // Sons de utensílios ocasionais (clicks e clinks)
    const clickChance = Math.random();
    const click = clickChance > 0.9998
      ? whiteNoise() * 0.3 * Math.exp(-80 * ((t % (1 / SAMPLE_RATE))))
      : 0;

    // Máquina de café (zumbido grave ~120Hz com modulação)
    const machine = 0.02 * Math.sin(2 * Math.PI * 120 * t)
                       * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / 15.0));

    samples[i] = murmur + ambient + click + machine;
  }

  // Filtro para simular propagação acústica de ambiente fechado
  const filtered = lowPassFilter(samples, 0.3);
  applyFades(filtered, 2.0);
  normalize(filtered, 0.78);
  saveWav('cafe.wav', filtered);
}

function generateOcean() {
  console.log('\n🌊 Gerando ondas do mar...');
  const samples = new Float32Array(TOTAL_SAMPLES);
  const pink = new PinkNoise();

  // Parâmetros das ondas (período de 6-12s, como ondas reais)
  const waveParams = [
    { period: 8.5,  amp: 0.55, phase: 0.0 },
    { period: 11.2, amp: 0.30, phase: 2.1 },
    { period: 6.3,  amp: 0.20, phase: 4.5 },
    { period: 14.0, amp: 0.15, phase: 1.0 },
  ];

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;

    // Envelope das ondas (cada onda tem crista e vale)
    let envelope = 0;
    for (const w of waveParams) {
      // A onda aumenta suavemente e recua rapidamente (onda quebrando)
      const phase  = (t / w.period + w.phase / (2 * Math.PI)) % 1;
      const shape  = phase < 0.6
        ? Math.sin(Math.PI * phase / 0.6)       // subida suave
        : Math.sin(Math.PI * (1 - (phase - 0.6) / 0.4) * 0.5); // descida rápida
      envelope += w.amp * Math.max(0, shape);
    }

    // Ruído base modulado pela amplitude da onda (a quebra é mais ruidosa)
    const base  = pink.next();
    const surge = envelope * 1.2;

    // Espuma (ruído de alta frequência na crista)
    const foam  = envelope > 0.5 ? whiteNoise() * (envelope - 0.4) * 0.3 : 0;

    samples[i] = base * (0.25 + 0.75 * surge) + foam;
  }

  // Filtro forte para dar o som característico de água
  const filtered = lowPassFilter(samples, 0.12);
  applyFades(filtered, 3.0);
  normalize(filtered, 0.82);
  saveWav('ocean.wav', filtered);
}

function generateFireplace() {
  console.log('\n🔥 Gerando lareira...');
  const samples = new Float32Array(TOTAL_SAMPLES);
  const pink = new PinkNoise();

  // Para gerenciar estalos (crackles)
  let crackleDecay = 0.992;
  let crackleAmp = 0;
  
  // Para gerenciar o sopro/chiado do fogo (hissing)
  let hissDecay = 0.9995;
  let hissAmp = 0;

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;

    // 1. Ruído base da chama/combustão (ruído rosa modulado para dar sensação de labaredas oscilantes)
    const flameMod = 0.5 + 0.3 * Math.sin(2 * Math.PI * t / 4.1) + 0.2 * Math.sin(2 * Math.PI * t / 1.7);
    const flameBase = pink.next() * (0.35 + 0.15 * Math.sin(2 * Math.PI * flameMod * t));

    // 2. Estalos de madeira (Wood crackles - impulsos rápidos)
    if (Math.random() < 0.0002) { // aprox 4.4 estalos por segundo
      crackleAmp = 0.6 + Math.random() * 0.4;
      crackleDecay = 0.985 + Math.random() * 0.012;
    }

    let crackle = 0;
    if (crackleAmp > 0.001) {
      crackle = whiteNoise() * crackleAmp;
      crackleAmp *= crackleDecay;
    }

    // 3. Pequenos chiados de seiva/gás (sap hissing - mais longos e agudos)
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

  // Filtramos levemente para aquecer o som geral sem abafar os estalos
  const filtered = lowPassFilter(samples, 0.45);
  applyFades(filtered, 2.0);
  normalize(filtered, 0.78);
  saveWav('fireplace.wav', filtered);
}

// ─── Execução ─────────────────────────────────────────────────────────────────

(function main() {
  console.log('🎵 Gerador de Sons Ambiente — MyFlowDay');
  console.log('==========================================');

  // Garante que a pasta existe
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    console.log(`📁 Pasta criada: ${OUT_DIR}`);
  }

  console.log(`⚙️  Configurações: ${SAMPLE_RATE}Hz | ${BITS}-bit | Mono | ${DURATION}s por arquivo`);

  generateWhiteNoise();
  generateRain();
  generateForest();
  generateCafe();
  generateOcean();
  generateFireplace();

  console.log('\n✨ Todos os sons foram gerados com sucesso!');
  console.log(`📂 Localização: ${OUT_DIR}`);
  console.log('\n⚠️  IMPORTANTE: Os arquivos foram gerados como .wav');
  console.log('   O FocusView foi atualizado para referenciar .wav automaticamente.');
  console.log('   (Novo som: fireplace.wav)');
})();
