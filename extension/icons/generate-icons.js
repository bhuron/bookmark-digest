#!/usr/bin/env node

/**
 * Icon generator for Bookmark Digest extension
 * Run with: node generate-icons.js
 *
 * Requirements: npm install canvas
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SVG icon content (book/bookmark design)
const svgIcon = `
<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="256" height="256" rx="48" fill="#2563eb"/>

  <!-- Book shape -->
  <rect x="48" y="56" width="160" height="144" rx="8" fill="white" opacity="0.95"/>

  <!-- Bookmark ribbon -->
  <path d="M128 56 L144 80 L144 160 L128 144 L112 160 L112 80 Z" fill="#ef4444"/>

  <!-- Bookmark inner ribbon -->
  <path d="M128 56 L140 76 L140 152 L128 140 L116 152 L116 76 Z" fill="#dc2626"/>

  <!-- Book spine line -->
  <rect x="116" y="56" width="24" height="144" fill="#1e40af" opacity="0.2"/>

  <!-- Bookmark highlight -->
  <path d="M128 56 L140 76 L140 78 L128 60 Z" fill="white" opacity="0.3"/>
</svg>
`;

// Save SVG version
fs.writeFileSync(path.join(__dirname, 'icon.svg'), svgIcon.trim());
console.log('✓ Created icon.svg');

// Try to use sharp if available for PNG generation
let sharp;
try {
  const sharpModule = await import('sharp');
  sharp = sharpModule.default;
} catch (e) {
  console.log('⚠ sharp not found. Install with: npm install sharp');
  console.log('  Alternatively, convert the SVG manually:');
  console.log('  - Online: https://cloudconvert.com/svg-to-png');
  console.log('  - CLI: convert icon.svg -resize 16x16 icon16.png');
  console.log('  - CLI: magick icon.svg -resize 48x48 icon48.png');
  console.log('  - CLI: magick icon.svg -resize 128x128 icon128.png');
}

// Generate PNG icons if sharp is available
if (sharp) {
  const sizes = [16, 48, 128];

  await Promise.all(sizes.map(async (size) => {
    try {
      await sharp(Buffer.from(svgIcon))
        .resize(size, size)
        .png()
        .toFile(path.join(__dirname, `icon${size}.png`));

      console.log(`✓ Created icon${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to create icon${size}.png:`, error.message);
    }
  }));

  console.log('\n✓ All icons generated successfully!');
} else {
  // Create simple placeholder files
  const sizes = [16, 48, 128];

  sizes.forEach(size => {
    // Create a minimal 1x1 PNG as placeholder
    const placeholderPNG = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, // IHDR length
      0x49, 0x48, 0x44, 0x52, // IHDR type
      0x00, 0x00, 0x00, 0x01, // width: 1
      0x00, 0x00, 0x00, 0x01, // height: 1
      0x08, 0x02, 0x00, 0x00, 0x00, // bit depth: 8, color type: 2 (RGB)
      0x90, 0x77, 0x53, 0xDE, // CRC
      0x00, 0x00, 0x00, 0x0C, // IDAT length
      0x49, 0x44, 0x41, 0x54, // IDAT type
      0x28, 0x15, 0x63, 0x60, // IDAT data (compressed RGB)
      0x18, 0x05, 0x00, 0x00,
      0x00, 0x00, 0x01,
      0x00, 0x01, // IEND
      0x5A, 0x7E, 0x9E, 0x6B  // IEND CRC
    ]);

    fs.writeFileSync(path.join(__dirname, `icon${size}.png`), placeholderPNG);
    console.log(`✓ Created placeholder icon${size}.png (needs proper conversion)`);
  });

  console.log('\n⚠ Placeholders created. Please convert icon.svg to PNG for proper icons.');
}

console.log('\nIcon sizes needed: 16x16, 48x48, 128x128');
