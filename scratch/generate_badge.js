import fs from 'fs';
import zlib from 'zlib';

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  
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
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
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

// Pure white monochrome alpha silhouette for mobile notification status bar badge
function drawNotificationBadge(x, y, width, height) {
  const nx = x / width;
  const ny = y / height;

  // Dot top right
  const dotDist = Math.hypot(nx - 0.78, ny - 0.28);
  if (dotDist <= 0.08) {
    return [255, 255, 255, 255]; // Pure White
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

  const strokeWidth = 0.06;
  if (minDist <= strokeWidth) {
    return [255, 255, 255, 255]; // Pure White Silhouette
  }

  return [0, 0, 0, 0]; // 100% Transparent background
}

console.log('Gerando notification badge transparente alfa puro...');
const badgeBuf = createPNG(96, 96, drawNotificationBadge);
fs.writeFileSync('public/branding/notification-badge.png', badgeBuf);
fs.writeFileSync('public/notification-badge.png', badgeBuf);
console.log('✓ Gerado public/branding/notification-badge.png (96x96)');
