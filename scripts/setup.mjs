#!/usr/bin/env node

/**
 * Prepare the runtime state a fresh checkout needs but cannot commit.
 *
 * Dependencies are installed by the root `setup` script; this only creates the
 * root `.env`. That file matters more than it looks: the backend reads
 * `<repo>/.env`, and without it PORT falls back to 3000 while the Vite proxy,
 * the browser extension and the docs all assume 3001.
 *
 * Safe to run repeatedly - an existing .env is never touched, and nothing is
 * printed when there is nothing to do, so `npm run dev` can call it first.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const envPath = path.join(repoRoot, '.env');
const envExamplePath = path.join(repoRoot, 'backend', '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    // The file holds the SMTP password once configured
    fs.chmodSync(envPath, 0o600);
    console.log('✓ Created .env from backend/.env.example');
  } else {
    console.warn('! backend/.env.example is missing, so .env was not created');
  }
}
