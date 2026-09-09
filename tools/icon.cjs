// Hephaestus app icon generator — zero dependencies, pure Node.
// Draws a crisp white anvil glyph on black, supersampled, writes a 1024x1024 PNG.
// Regenerate: node tools/icon.js   (then: npx tauri icon src-tauri/icons/app-icon.png)
"use strict";
const zlib = require("node:zlib");
const fs = require("node:fs");

const S = 1024; // canvas
const SS = 3; // supersample
const W = S * SS;

// ---------- tiny PNG encoder (RGBA8) ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(rgba, size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- geometry ----------
const P = (x, y) => ({ x, y });

function inRoundRect(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const cx = Math.max(x0 + r, Math.min(px, x1 - r));
  const cy = Math.max(y0 + r, Math.min(py, y1 - r));
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function inPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

// Model coordinates (logical 1024 space). y offset so the glyph sits centered.
const DY = -72;
const shapes = [
  // strike block: flat left face, gentle rounding
  (x, y) => inRoundRect(x, y, 252, 352 + DY, 564, 596 + DY, 18),
  // waist flare into the base
  (x, y) => inPoly(x, y, [P(252, 588 + DY), P(564, 588 + DY), P(592, 636 + DY), P(224, 636 + DY)]),
  // base plinth
  (x, y) => inRoundRect(x, y, 196, 636 + DY, 828, 748 + DY, 26),
  // horn: sloped arm falling away to the right, tapered
  (x, y) => inPoly(x, y, [P(544, 380 + DY), P(812, 522 + DY), P(812, 556 + DY), P(556, 636 + DY)]),
  // horn tip cap (makes the tip read as forged steel, not a spike)
  (x, y) => inPoly(x, y, [P(800, 520 + DY), P(828, 532 + DY), P(828, 552 + DY), P(796, 560 + DY)]),
];

const OUT = Buffer.alloc(S * S * 4);
for (let py = 0; py < S; py++) {
  for (let px = 0; px < S; px++) {
    let hit = 0;
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++) {
        const x = px + (sx + 0.5) / SS;
        const y = py + (sy + 0.5) / SS;
        for (const s of shapes) if (s(x, y)) { hit++; break; }
      }
    const cov = hit / (SS * SS);
    const o = (py * S + px) * 4;
    if (cov > 0) {
      // pure white glyph
      OUT[o] = OUT[o + 1] = OUT[o + 2] = 255;
      OUT[o + 3] = Math.round(255 * Math.min(1, cov));
    }
    // background stays black
  }
}

fs.writeFileSync(__dirname + "/../src-tauri/icons/app-icon.png", encodePng(OUT, S));
console.log("wrote src-tauri/icons/app-icon.png");
