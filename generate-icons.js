// Pure Node.js PNG generator — no dependencies required.
// Renders the Waspes gradient cube (cyan → emerald → lime) on a dark rounded
// card, matching the in-app CubeIcon mark (src/components/CubeIcon.tsx). Vector
// math, so it's crisp at 1024×1024. electron-builder derives .ico/.icns from it.
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

function writePNG(width, height, getRGB) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getRGB(x, y);
      row[1 + x * 3] = r;
      row[1 + x * 3 + 1] = g;
      row[1 + x * 3 + 2] = b;
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const crcTable = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  function crc32(buf, off, len) {
    let crc = -1;
    for (let i = off; i < off + len; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
  }
  function chunk(type, data) {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out, 4, 4 + data.length), 8 + data.length);
    return out;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, colour type 2 (RGB)
  return Buffer.concat([
    // PNG signature as explicit bytes — Buffer.from("\x89PNG…") would UTF-8
    // encode 0x89 as 0xC2 0x89 and corrupt the file.
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [
  Math.round(lerp(c1[0], c2[0], t)),
  Math.round(lerp(c1[1], c2[1], t)),
  Math.round(lerp(c1[2], c2[2], t)),
];

// Cube gradient stops (match CubeIcon.tsx).
const CYAN = [0x22, 0xd3, 0xee];
const EMER = [0x34, 0xd3, 0x99];
const LIME = [0xa3, 0xe6, 0x35];
// Dark card: near-black with a faint cool tint, blending to pure dark.
const CARD_TL = [0x0d, 0x12, 0x18];
const CARD_BR = [0x09, 0x09, 0x0f];
const VOID = [0x09, 0x09, 0x0f]; // outside the rounded card

// Cube faces in the 0..64 viewBox space (from CubeIcon.tsx paths).
const TOP = [[32, 7], [55, 20], [32, 33], [9, 20]];
const LEFT = [[9, 20], [32, 33], [32, 58], [9, 45]];
const RIGHT = [[55, 20], [32, 33], [32, 58], [55, 45]];
// Gradient axis A→B (userSpaceOnUse: x1 9 y1 7 → x2 55 y2 58).
const AX = 9, AY = 7, DX = 46, DY = 51, LEN2 = DX * DX + DY * DY;

function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function gradAt(vx, vy) {
  let t = ((vx - AX) * DX + (vy - AY) * DY) / LEN2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t < 0.5 ? mix(CYAN, EMER, t / 0.5) : mix(EMER, LIME, (t - 0.5) / 0.5);
}

const SIZE = 1024;
// Cube occupies a centred ~74% square; the 0..64 viewBox maps onto it.
const AREA = Math.round(SIZE * 0.74);
const OFF = (SIZE - AREA) / 2;

function pixelColor(X, Y) {
  const nx = X / SIZE, ny = Y / SIZE;
  // Rounded-card mask (radius ~0.215 of the side, as the old mark used).
  const r = 0.215;
  const dxm = Math.max(0, Math.abs(nx - 0.5) - (0.5 - r));
  const dym = Math.max(0, Math.abs(ny - 0.5) - (0.5 - r));
  if (dxm * dxm + dym * dym > r * r) return VOID;
  const card = mix(CARD_TL, CARD_BR, (nx + ny) / 2);

  // Map pixel into viewBox space.
  const vx = ((X - OFF) / AREA) * 64;
  const vy = ((Y - OFF) / AREA) * 64;
  if (vx < 0 || vx > 64 || vy < 0 || vy > 64) return card;

  if (inPoly(vx, vy, TOP)) {
    return mix(gradAt(vx, vy), [255, 255, 255], 0.14); // lit top + white glaze
  }
  if (inPoly(vx, vy, LEFT)) {
    return mix(card, gradAt(vx, vy), 0.8); // opacity .8 over card
  }
  if (inPoly(vx, vy, RIGHT)) {
    return mix(card, gradAt(vx, vy), 0.56); // opacity .56 over card
  }
  return card;
}

const png = writePNG(SIZE, SIZE, pixelColor);
fs.mkdirSync(path.join(__dirname, "build"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "build", "icon.png"), png);
console.log("✓ build/icon.png generated (" + SIZE + "×" + SIZE + ", Waspes cube)");
