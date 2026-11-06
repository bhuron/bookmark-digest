#!/usr/bin/env node
// Regenerate the extension's PNG icons from extension/icons/icon.svg.
// Uses the sharp that the backend already depends on, so it needs
// `npm install --prefix backend` (or `npm run setup`) to have run first.

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const require = createRequire(path.join(repoRoot, 'backend', 'package.json'));

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('sharp is not installed. Run: npm install --prefix backend');
  process.exit(1);
}

const svg = path.join(repoRoot, 'extension', 'icons', 'icon.svg');
const sizes = [16, 48, 128];

for (const size of sizes) {
  const out = path.join(repoRoot, 'extension', 'icons', `icon${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(out);
  console.log(`wrote extension/icons/icon${size}.png (${size}x${size})`);
}
