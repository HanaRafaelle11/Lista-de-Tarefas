import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';

const BRANDING_DIR = path.join(process.cwd(), 'public', 'branding');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

if (!fs.existsSync(BRANDING_DIR)) {
  fs.mkdirSync(BRANDING_DIR, { recursive: true });
}

// 1. Símbolo isolado (1024x1024 viewBox para icon)
const symbolSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="flow" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="50%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#5EEAD4" />
    </linearGradient>
  </defs>
  <path d="M 100 700 L 280 340 L 430 540 L 580 340 L 730 540 L 880 340" fill="none" stroke="url(#flow)" stroke-width="130" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="950" cy="200" r="70" fill="#5EEAD4" />
</svg>`;

// 2. Símbolo + texto MyFlowDay (fundo transparente)
const logoLight = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 800" width="2400" height="800">
  <defs>
    <linearGradient id="flow" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="50%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#5EEAD4" />
    </linearGradient>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@600&amp;display=swap');
      .text { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 320px; fill: #0F172A; letter-spacing: -8px; }
    </style>
  </defs>
  <g transform="translate(100, 150) scale(0.5)">
    <path d="M 100 700 L 280 340 L 430 540 L 580 340 L 730 540 L 880 340" fill="none" stroke="url(#flow)" stroke-width="130" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="950" cy="200" r="70" fill="#5EEAD4" />
  </g>
  <text x="750" y="520" class="text">MyFlowDay</text>
</svg>`;

// 3. Versão dark (#0F172A)
const logoDark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 800" width="2400" height="800">
  <rect width="2400" height="800" fill="#0F172A" />
  <defs>
    <linearGradient id="flow" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="50%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#5EEAD4" />
    </linearGradient>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@600&amp;display=swap');
      .text { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 320px; fill: #FFFFFF; letter-spacing: -8px; }
    </style>
  </defs>
  <g transform="translate(100, 150) scale(0.5)">
    <path d="M 100 700 L 280 340 L 430 540 L 580 340 L 730 540 L 880 340" fill="none" stroke="url(#flow)" stroke-width="130" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="950" cy="200" r="70" fill="#5EEAD4" />
  </g>
  <text x="750" y="520" class="text">MyFlowDay</text>
</svg>`;

// 4. Versão Monocromática
const logoMono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 800" width="2400" height="800">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@600&amp;display=swap');
      .text { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 320px; fill: #0F172A; letter-spacing: -8px; }
    </style>
  </defs>
  <g transform="translate(100, 150) scale(0.5)">
    <path d="M 100 700 L 280 340 L 430 540 L 580 340 L 730 540 L 880 340" fill="none" stroke="#0F172A" stroke-width="130" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="950" cy="200" r="70" fill="#0F172A" />
  </g>
  <text x="750" y="520" class="text">MyFlowDay</text>
</svg>`;

async function run() {
  console.log('Writing base SVGs...');
  fs.writeFileSync(path.join(BRANDING_DIR, 'logo.svg'), logoLight);
  fs.writeFileSync(path.join(BRANDING_DIR, 'logo-dark.svg'), logoDark);
  fs.writeFileSync(path.join(BRANDING_DIR, 'logo-light.svg'), logoLight);
  fs.writeFileSync(path.join(BRANDING_DIR, 'logo-mono.svg'), logoMono);

  console.log('Rendering 1024x1024 base PNG with resvg...');
  const opts = {
    background: 'rgba(0,0,0,0)',
    fitTo: {
      mode: 'width',
      value: 1024
    },
    font: {
      loadSystemFonts: false, 
    }
  };
  
  const resvg = new Resvg(Buffer.from(symbolSvg.trim()), opts);
  const pngData = resvg.render();
  const iconBuffer = pngData.asPng();
  
  fs.writeFileSync(path.join(BRANDING_DIR, 'icon-1024.png'), iconBuffer);

  console.log('Generating other PWA icons with sharp...');
  const sizes = [512, 192, 152];
  for (const size of sizes) {
    await sharp(iconBuffer)
      .resize(size, size)
      .toFile(path.join(BRANDING_DIR, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  // Favicon
  await sharp(iconBuffer)
    .resize(32, 32)
    .toFile(path.join(PUBLIC_DIR, 'favicon.ico'));
  console.log('Generated favicon.ico');

  console.log('Generating Splash Screens...');
  // Android 1080x1920
  const splashIconAndroidBuffer = await sharp(iconBuffer).resize(400, 400).toBuffer();
  await sharp({
    create: { width: 1080, height: 1920, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } }
  })
    .composite([{ input: splashIconAndroidBuffer, gravity: 'center' }])
    .toFile(path.join(BRANDING_DIR, 'splash-android.png'));
  console.log('Generated splash-android.png');

  // iOS 1170x2532
  const splashIconIosBuffer = await sharp(iconBuffer).resize(450, 450).toBuffer();
  await sharp({
    create: { width: 1170, height: 2532, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } }
  })
    .composite([{ input: splashIconIosBuffer, gravity: 'center' }])
    .toFile(path.join(BRANDING_DIR, 'splash-iphone.png'));
  console.log('Generated splash-iphone.png');

  console.log('Branding generation successful.');
}

run().catch(console.error);
