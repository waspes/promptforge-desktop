// Run once: node generate-icons.js
// Requires: npm install sharp png-to-ico (run first)
const fs = require("fs");
const path = require("path");

// SVG icon: dark bg + orange/violet gradient lightning bolt
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a0a2e"/>
      <stop offset="100%" style="stop-color:#09090f"/>
    </linearGradient>
    <linearGradient id="bolt" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f97316"/>
      <stop offset="100%" style="stop-color:#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="110" fill="url(#bg)"/>
  <polygon points="290,60 170,280 248,280 222,452 342,232 264,232 290,60" fill="url(#bolt)"/>
</svg>`;

const sharp = require("sharp");

async function generate() {
  const svgBuf = Buffer.from(svg);
  const buildDir = path.join(__dirname, "build");

  // 1024x1024 master PNG
  const png1024 = await sharp(svgBuf).resize(1024, 1024).png().toBuffer();
  fs.writeFileSync(path.join(buildDir, "icon.png"), png1024);
  console.log("✓ icon.png (1024x1024)");

  // 512x512 for Linux
  const png512 = await sharp(svgBuf).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(buildDir, "icon_512.png"), png512);
  console.log("✓ icon_512.png");

  console.log("Icons generated. electron-builder will auto-create .ico and .icns from icon.png");
}

generate().catch(console.error);
