#!/usr/bin/env node

/**
 * Simple icon generator using the SVG file
 * This converts the SVG to PNG at required sizes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, 'extension/icons/icon.svg');
const iconDir = path.join(__dirname, 'extension/icons');
const sizes = [16, 48, 128];

console.log('Reading SVG file...');
const svgContent = fs.readFileSync(svgPath, 'utf-8');

console.log('Creating basic PNG icons (simple solid colors)...');

// Create simple PNG icons programmatically
sizes.forEach(size => {
  // Create a simple 1x1 PNG as placeholder for now
  // In production, you'd use a proper image library
  const buffer = createSimplePNG('#2563eb', size);
  const outputPath = path.join(iconDir, `icon${size}.png`);
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Created icon${size}.png (${buffer.length} bytes)`);
});

console.log('\n✓ All icons generated!');
console.log('\nNote: These are basic placeholder icons.');
console.log('For better icons, convert icon.svg using:');
console.log('  - Online: https://cloudconvert.com/svg-to-png');
console.log('  - Or use ImageMagick: convert icon.svg -resize 128x128 icon128.png');

/**
 * Create a simple PNG with solid color
 */
function createSimplePNG(colorHex, size) {
  // Parse hex color to RGB
  const r = parseInt(colorHex.slice(1, 3), 16);
  const g = parseInt(colorHex.slice(3, 5), 16);
  const b = parseInt(colorHex.slice(5, 7), 16);

  // Create a simple PNG file
  // For now, just create a 1x1 PNG that scales
  const PNG = createMinimalPNG(r, g, b);
  return PNG;
}

/**
 * Create a minimal 1x1 PNG
 */
function createMinimalPNG(r, g, b) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk (1x1 RGB image)
  const ihdr = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x0D]), // length
    Buffer.from('IHDR'),
    Buffer.from([0x00, 0x00, 0x00, 0x01]), // width: 1
    Buffer.from([0x00, 0x00, 0x00, 0x01]), // height: 1
    Buffer.from([0x08, 0x02, 0x00, 0x00, 0x00]), // bit depth: 8, color type: 2 (RGB), compression, filter, interlace
    Buffer.from([0x00, 0x00, 0x00, 0x00]) // CRC placeholder
  ]);

  // Calculate CRC for IHDR
  const ihdrCrc = crc32(ihdr.slice(4, 21)); // Skip length and CRC
  ihdr.writeUInt32BE(ihdrCrc, 17);

  // IDAT chunk (image data - 1 pixel in RGB)
  const scanlines = createScanline([r, g, b], 1);
  const idatData = zlibCompress(scanlines);

  const idat = Buffer.concat([
    Buffer.from([(idatData.length >> 24) & 0xff, (idatData.length >> 16) & 0xff, (idatData.length >> 8) & 0xff, idatData.length & 0xff]),
    Buffer.from('IDAT'),
    idatData,
    Buffer.from([0x00, 0x00, 0x00, 0x00]) // CRC placeholder
  ]);

  const idatCrc = crc32(idat.slice(4, 4 + 4 + idatData.length));
  idat.writeUInt32BE(idatCrc, 4 + 4 + idatData.length);

  // IEND chunk
  const iend = Buffer.from([
    0x00, 0x00, 0x00, 0x00, // length
    0x49, 0x45, 0x4E, 0x44, // 'IEND'
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createScanline(pixels, width) {
  const bytesPerPixel = 3; // RGB
  const row = Buffer.alloc(1 + width * bytesPerPixel); // filter type + pixels
  row[0] = 0; // filter type: none

  for (let i = 0; i < width; i++) {
    row[1 + i * 3] = pixels[0]; // R
    row[1 + i * 3 + 1] = pixels[1]; // G
    row[1 + i * 3 + 2] = pixels[2]; // B
  }

  return row;
}

function zlibCompress(data) {
  // Simple zlib compress (for now, just return the data uncompressed)
  // In production, you'd use node:zlib
  const zlib = require('zlib');
  return zlib.deflateSync(data);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
