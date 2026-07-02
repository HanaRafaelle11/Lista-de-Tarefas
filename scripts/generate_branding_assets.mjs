import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Caminhos do projeto
const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const brandingDir = path.join(publicDir, 'branding');

// Garante que os diretórios existem
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(brandingDir)) {
  fs.mkdirSync(brandingDir, { recursive: true });
}

// ── Definições de Cores e Gradientes ──────────────────────────────────────
const primaryGradient = `
  <linearGradient id="flow" x1="0%" y1="100%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#5E60CE" />
    <stop offset="100%" stop-color="#00E5C3" />
  </linearGradient>
`;

const monoGradient = `
  <linearGradient id="flow" x1="0%" y1="100%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#FBFAFC" />
    <stop offset="100%" stop-color="#FBFAFC" />
  </linearGradient>
`;

const darkGradient = `
  <linearGradient id="flow" x1="0%" y1="100%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#5E60CE" />
    <stop offset="100%" stop-color="#00E5C3" />
  </linearGradient>
`;

// Desenho da onda do "M" e do círculo do topo
const iconPath = `<path d="M 100 700 L 280 340 L 430 540 L 580 340 L 730 540 L 880 340" fill="none" stroke="url(#flow)" stroke-width="130" stroke-linecap="round" stroke-linejoin="round" />`;
const iconDot = `<circle cx="950" cy="200" r="70" fill="#00E5C3" />`;
const iconDotMono = `<circle cx="950" cy="200" r="70" fill="#FBFAFC" />`;

// ── Código-fonte dos SVGs Oficiais ────────────────────────────────────────

// 1. Logo Horizontal (Light - fundo escuro)
const logoLightSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 800" width="2400" height="800">
  <defs>
    ${primaryGradient}
  </defs>
  <g transform="translate(80, 150) scale(0.55)">
    ${iconPath}
    ${iconDot}
  </g>
  <text x="720" y="440" font-family="'Plus Jakarta Sans', sans-serif" font-size="220px" font-weight="800" fill="#FBFAFC" letter-spacing="-6px">MyFlowDay</text>
  <text x="730" y="580" font-family="'Plus Jakarta Sans', sans-serif" font-size="52px" font-weight="700" fill="#A1A7B3" letter-spacing="14px">FOCO • CONSISTÊNCIA • EVOLUÇÃO</text>
</svg>
`;

// 2. Logo Horizontal (Dark - fundo claro)
const logoDarkSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 800" width="2400" height="800">
  <defs>
    ${darkGradient}
  </defs>
  <g transform="translate(80, 150) scale(0.55)">
    ${iconPath}
    ${iconDot}
  </g>
  <text x="720" y="440" font-family="'Plus Jakarta Sans', sans-serif" font-size="220px" font-weight="800" fill="#0B0E11" letter-spacing="-6px">MyFlowDay</text>
  <text x="730" y="580" font-family="'Plus Jakarta Sans', sans-serif" font-size="52px" font-weight="700" fill="#475569" letter-spacing="14px">FOCO • CONSISTÊNCIA • EVOLUÇÃO</text>
</svg>
`;

// 3. Logo Monocromático
const logoMonoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 800" width="2400" height="800">
  <defs>
    ${monoGradient}
  </defs>
  <g transform="translate(80, 150) scale(0.55)">
    ${iconPath}
    ${iconDotMono}
  </g>
  <text x="720" y="440" font-family="'Plus Jakarta Sans', sans-serif" font-size="220px" font-weight="800" fill="#FBFAFC" letter-spacing="-6px">MyFlowDay</text>
  <text x="730" y="580" font-family="'Plus Jakarta Sans', sans-serif" font-size="52px" font-weight="700" fill="#FBFAFC" letter-spacing="14px">FOCO • CONSISTÊNCIA • EVOLUÇÃO</text>
</svg>
`;

// 4. Logo Vertical
const logoVerticalSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" width="1200" height="1200">
  <defs>
    ${primaryGradient}
  </defs>
  <g transform="translate(340, 100) scale(0.55)">
    ${iconPath}
    ${iconDot}
  </g>
  <text x="50%" y="740" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="120px" font-weight="800" fill="#FBFAFC" letter-spacing="-3px">MyFlowDay</text>
  <text x="50%" y="840" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="30px" font-weight="700" fill="#A1A7B3" letter-spacing="6px">FOCO • CONSISTÊNCIA • EVOLUÇÃO</text>
</svg>
`;

// 5. Ícone do App (com fundo sólido #12161A e margens)
const appIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    ${primaryGradient}
  </defs>
  <rect width="1024" height="1024" rx="220" fill="#12161A" />
  <g transform="translate(245, 290) scale(0.48)">
    ${iconPath}
    ${iconDot}
  </g>
</svg>
`;

// 6. Símbolo com fundo transparente (icon.svg)
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    ${primaryGradient}
  </defs>
  <g transform="translate(200, 250) scale(0.575)">
    ${iconPath}
    ${iconDot}
  </g>
</svg>
`;

// 7. Favicon (com fundo transparente)
const faviconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    ${primaryGradient}
  </defs>
  <g transform="translate(200, 250) scale(0.575)">
    ${iconPath}
    ${iconDot}
  </g>
</svg>
`;

// ── Salvar Arquivos SVGs ──────────────────────────────────────────────────
fs.writeFileSync(path.join(brandingDir, 'logo-light.svg'), logoLightSvg.trim());
fs.writeFileSync(path.join(brandingDir, 'logo-dark.svg'), logoDarkSvg.trim());
fs.writeFileSync(path.join(brandingDir, 'logo-mono.svg'), logoMonoSvg.trim());
fs.writeFileSync(path.join(brandingDir, 'logo-vertical.svg'), logoVerticalSvg.trim());
fs.writeFileSync(path.join(brandingDir, 'app-icon.svg'), appIconSvg.trim());
fs.writeFileSync(path.join(brandingDir, 'logo.svg'), logoLightSvg.trim()); // Default logo horizontal

// Também copia/salva na raiz do public
fs.writeFileSync(path.join(publicDir, 'icon.svg'), iconSvg.trim());
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg.trim());
fs.writeFileSync(path.join(publicDir, 'icons.svg'), iconSvg.trim()); // Legacy compatibility

console.log('[Branding Generator] Arquivos SVG criados com sucesso!');

// ── Renderização PNG com Sharp ────────────────────────────────────────────
async function renderPng(svgContent, size, outputPath) {
  try {
    await sharp(Buffer.from(svgContent.trim()))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`[Branding Generator] Renderizado PNG: ${outputPath} (${size}x${size})`);
  } catch (err) {
    console.error(`[Branding Generator] Erro ao renderizar PNG (${size}x${size}):`, err);
  }
}

async function run() {
  // 1. Ícones do App (fundo sólido #12161A) em vários tamanhos
  const appIconSizes = [16, 32, 48, 64, 128, 192, 256, 512, 1024];
  for (const size of appIconSizes) {
    const filename = `icon-${size}.png`;
    await renderPng(appIconSvg, size, path.join(brandingDir, filename));
    
    // PWA & Favicon root compatibility
    if (size === 192) {
      await renderPng(appIconSvg, size, path.join(publicDir, 'icon-192.png'));
    }
    if (size === 512) {
      await renderPng(appIconSvg, size, path.join(publicDir, 'icon-512.png'));
    }
  }

  // 2. Apple Touch Icon e outros específicos
  await renderPng(appIconSvg, 180, path.join(publicDir, 'apple-touch-icon.png'));
  await renderPng(appIconSvg, 192, path.join(publicDir, 'icon.png'));
  
  // 3. Splash Screen (android/iphone)
  const splashSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" fill="#0B0E11">
    <defs>
      ${primaryGradient}
    </defs>
    <rect width="1024" height="1024" fill="#0B0E11" />
    <g transform="translate(340, 240) scale(0.35)">
      ${iconPath}
      ${iconDot}
    </g>
    <text x="50%" y="700" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="64px" font-weight="800" fill="#FBFAFC" letter-spacing="-2px">MyFlowDay</text>
  </svg>
  `;
  await renderPng(splashSvg, 512, path.join(brandingDir, 'splash-android.png'));
  await renderPng(splashSvg, 512, path.join(brandingDir, 'splash-iphone.png'));
  
  // 4. Notification badge (círculo do topo transparente com preenchimento branco)
  const badgeSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
    <circle cx="48" cy="48" r="40" fill="#FBFAFC" />
  </svg>
  `;
  await renderPng(badgeSvg, 96, path.join(brandingDir, 'notification-badge.png'));
  await renderPng(badgeSvg, 96, path.join(publicDir, 'notification-badge.png'));

  console.log('[Branding Generator] Todos os PNGs foram gerados com sucesso!');
}

run();
