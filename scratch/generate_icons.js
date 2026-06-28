import fs from 'fs';
import zlib from 'zlib';

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  
  // CRC32 implementation
  let crc = 0xffffffff;
  for (let i = 0; i < typeAndData.length; i++) {
    let c = (crc ^ typeAndData[i]) & 0xff;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc = (crc >>> 8) ^ c;
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function createPNG(width, height, drawFn) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const color = drawFn(x, y, width, height);
      rawData[pxOffset] = color[0];
      rawData[pxOffset + 1] = color[1];
      rawData[pxOffset + 2] = color[2];
      rawData[pxOffset + 3] = color[3];
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function drawFlowdayIcon(x, y, width, height) {
  const nx = x / width;
  const ny = y / height;
  
  const cornerRadius = 0.20;
  let inBounds = true;
  if (nx < cornerRadius && ny < cornerRadius) {
    if (Math.hypot(nx - cornerRadius, ny - cornerRadius) > cornerRadius) inBounds = false;
  } else if (nx > 1 - cornerRadius && ny < cornerRadius) {
    if (Math.hypot(nx - (1 - cornerRadius), ny - cornerRadius) > cornerRadius) inBounds = false;
  } else if (nx < cornerRadius && ny > 1 - cornerRadius) {
    if (Math.hypot(nx - cornerRadius, ny - (1 - cornerRadius)) > cornerRadius) inBounds = false;
  } else if (nx > 1 - cornerRadius && ny > 1 - cornerRadius) {
    if (Math.hypot(nx - (1 - cornerRadius), ny - (1 - cornerRadius)) > cornerRadius) inBounds = false;
  }

  if (!inBounds) return [0, 0, 0, 0];

  // Slate Background #0F172A
  let r = 0x0F, g = 0x17, b = 0x2A, a = 255;

  const dotDist = Math.hypot(nx - 0.78, ny - 0.28);
  if (dotDist <= 0.065) {
    return [0x5E, 0xEA, 0xD4, 255];
  }

  const points = [
    [0.18, 0.68],
    [0.30, 0.38],
    [0.42, 0.55],
    [0.54, 0.38],
    [0.66, 0.55],
    [0.78, 0.38]
  ];

  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  let minDist = 999;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distToSegment(nx, ny, points[i][0], points[i][1], points[i+1][0], points[i+1][1]);
    if (d < minDist) minDist = d;
  }

  const strokeWidth = 0.048;
  if (minDist <= strokeWidth) {
    const gradFactor = nx;
    if (gradFactor < 0.5) {
      const t = gradFactor / 0.5;
      return [
        Math.round(0x25 + (0x38 - 0x25) * t),
        Math.round(0x63 + (0xBD - 0x63) * t),
        Math.round(0xEB + (0xF8 - 0xEB) * t),
        255
      ];
    } else {
      const t = (gradFactor - 0.5) / 0.5;
      return [
        Math.round(0x38 + (0x5E - 0x38) * t),
        Math.round(0xBD + (0xEA - 0xBD) * t),
        Math.round(0xF8 + (0xD4 - 0xF8) * t),
        255
      ];
    }
  }

  return [r, g, b, a];
}

console.log('Gerando ícones PNG limpos sem barras pretas...');
const sizes = [
  { path: 'public/branding/icon-152.png', size: 152 },
  { path: 'public/branding/icon-192.png', size: 192 },
  { path: 'public/branding/icon-512.png', size: 512 },
  { path: 'public/branding/icon-1024.png', size: 1024 },
  { path: 'public/branding/logo-1x.png', size: 192 },
  { path: 'public/branding/logo-2x.png', size: 512 },
  { path: 'public/branding/logo-4x.png', size: 1024 },
  { path: 'public/logo.png', size: 512 }
];

sizes.forEach(({ path, size }) => {
  const pngBuf = createPNG(size, size, drawFlowdayIcon);
  fs.writeFileSync(path, pngBuf);
  console.log(`✓ Gerado ${path} (${size}x${size})`);
});
console.log('Todos os ícones foram gerados com sucesso!');
