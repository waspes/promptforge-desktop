// Pure Node.js PNG generator — no dependencies required
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
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from("\x89PNG\r\n\x1a\n"),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function pixelColor(x, y, w, h) {
  const nx = x / w, ny = y / h;
  const r = 0.215;
  const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - r));
  const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - r));
  if (dx * dx + dy * dy > r * r) return [9, 9, 15];

  const t = (nx + ny) / 2;
  const bg = [
    Math.round(0x1a + (0x09 - 0x1a) * t),
    Math.round(0x0a + (0x09 - 0x0a) * t),
    Math.round(0x2e + (0x0f - 0x2e) * t),
  ];

  // Lightning bolt polygon (512px space → normalised)
  const poly = [
    [290/512, 60/512], [170/512, 280/512], [248/512, 280/512],
    [222/512, 452/512], [342/512, 232/512], [264/512, 232/512],
  ];
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > ny) !== (yj > ny) && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  if (inside) {
    const bt = (nx + ny) / 2;
    return [
      Math.round(0xf9 + (0x7c - 0xf9) * bt),
      Math.round(0x73 + (0x3a - 0x73) * bt),
      Math.round(0x16 + (0xed - 0x16) * bt),
    ];
  }
  return bg;
}

const SIZE = 512;
const png = writePNG(SIZE, SIZE, (x, y) => pixelColor(x, y, SIZE, SIZE));
fs.mkdirSync(path.join(__dirname, "build"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "build", "icon.png"), png);
console.log("✓ build/icon.png generated");
