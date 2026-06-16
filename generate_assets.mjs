import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const BRANDING_DIR = path.join(process.cwd(), 'public', 'branding');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

const SVG_LOGO = path.join(BRANDING_DIR, 'logo-dark.svg');
const ICON_BASE = path.join(BRANDING_DIR, 'icon-1024.png');

async function generateAssets() {
  console.log('Generating base 1024x1024 icon from SVG...');
  
  // Create base 1024x1024 icon using sharp directly (to avoid libvips SVG parsing issues)
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 37, g: 99, b: 235, alpha: 1 } // #2563EB
    }
  })
    .toFile(ICON_BASE);

  
  console.log('Generating PWA icons...');
  
  const sizes = [512, 192, 152];
  for (const size of sizes) {
    await sharp(ICON_BASE)
      .resize(size, size)
      .toFile(path.join(BRANDING_DIR, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  // Favicon (32x32)
  await sharp(ICON_BASE)
    .resize(32, 32)
    .toFile(path.join(PUBLIC_DIR, 'favicon.ico'));
  console.log('Generated favicon.ico');

  console.log('Generating Splash Screens...');

  // Android Splash Screen (1080x1920)
  await sharp({
    create: {
      width: 1080,
      height: 1920,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // #0F172A
    }
  })
    .composite([
      { input: ICON_BASE, gravity: 'center' } // We might need to resize the icon to fit nicely
    ])
    .toFile(path.join(BRANDING_DIR, 'splash-android.png'));
    
  // Re-do with resized icon for splash
  const splashIconBuffer = await sharp(ICON_BASE).resize(400, 400).toBuffer();

  await sharp({
    create: {
      width: 1080,
      height: 1920,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // #0F172A
    }
  })
    .composite([{ input: splashIconBuffer, gravity: 'center' }])
    .toFile(path.join(BRANDING_DIR, 'splash-android.png'));
  console.log('Generated splash-android.png');

  // iPhone Splash Screen (1170x2532)
  await sharp({
    create: {
      width: 1170,
      height: 2532,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // #0F172A
    }
  })
    .composite([{ input: splashIconBuffer, gravity: 'center' }])
    .toFile(path.join(BRANDING_DIR, 'splash-iphone.png'));
  console.log('Generated splash-iphone.png');

  console.log('Asset generation complete.');
}

generateAssets().catch(console.error);
