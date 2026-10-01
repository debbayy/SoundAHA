// Generates assets/icon.png, adaptive-icon.png (foreground), splash-icon.png and favicon.png.
// Run: node scripts/generate-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets');
const A = [0x7c, 0x5c, 0xff];
const B = [0x00, 0xb8, 0xd9];

// distance to a rounded rect centered at (cx,cy) with half-size (hw,hh) and radius r
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - (hw - r);
  const dy = Math.abs(py - cy) - (hh - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

function render(size, { background }) {
  const px = Buffer.alloc(size * size * 4);
  const heights = [0.3, 0.55, 0.8, 0.55, 0.3];
  const bw = size * 0.075;
  const gap = size * 0.05;
  const span = heights.length * bw + (heights.length - 1) * gap;
  const x0 = (size - span) / 2 + bw / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cov = 0;
      for (let i = 0; i < heights.length; i++) {
        const cx = x0 + i * (bw + gap);
        const d = sdRoundRect(x + 0.5, y + 0.5, cx, size / 2, bw / 2, (heights[i] * size * 0.55) / 2, bw / 2);
        cov = Math.max(cov, Math.min(1, Math.max(0, 0.5 - d)));
      }
      const t = (x + y) / (2 * size);
      const bg = A.map((c, k) => c + (B[k] - c) * t);
      const o = (y * size + x) * 4;
      if (background) {
        px[o] = bg[0] * (1 - cov) + 255 * cov;
        px[o + 1] = bg[1] * (1 - cov) + 255 * cov;
        px[o + 2] = bg[2] * (1 - cov) + 255 * cov;
        px[o + 3] = 255;
      } else {
        px[o] = px[o + 1] = px[o + 2] = 255;
        px[o + 3] = Math.round(cov * 255);
      }
    }
  }
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
const save = (name, size, opts) => {
  fs.writeFileSync(path.join(OUT, name), png(size, render(size, opts)));
  console.log(name, size + 'px');
};
save('icon.png', 1024, { background: true });
save('adaptive-icon.png', 1024, { background: false });
save('splash-icon.png', 512, { background: false });
save('favicon.png', 96, { background: true });
