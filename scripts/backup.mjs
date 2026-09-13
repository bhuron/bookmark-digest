#!/usr/bin/env node

/**
 * Back up the state that cannot be rebuilt from the repository:
 *
 *   - the SQLite database, which holds every article and the Kindle/SMTP
 *     configuration
 *   - config.json, which holds the API key
 *   - .env, which holds the SMTP password
 *
 * The database is copied with `VACUUM INTO` rather than fs.copyFile. In WAL mode
 * recent commits can still be sitting in the -wal file, so copying the .db alone
 * can produce a stale or torn backup without any error.
 *
 * Usage:
 *   npm run backup                 # -> backups/<timestamp>/
 *   npm run backup -- /some/dir    # -> /some/dir/
 *
 * Image files (backend/images) and EPUB exports are not included.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('../backend/node_modules/better-sqlite3');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const dbPath = path.join(repoRoot, 'backend', 'data', 'bookmark-digest.db');
const DB_NAME = 'bookmark-digest.db';

// Secrets, kept owner-only like their originals
const secretFiles = [
  path.join(repoRoot, 'config.json'),
  path.join(repoRoot, '.env')
];

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const destination = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, 'backups', stamp);

if (fs.existsSync(path.join(destination, DB_NAME))) {
  console.error(`✗ ${destination} already contains a backup - pick another directory`);
  process.exit(1);
}

fs.mkdirSync(destination, { recursive: true });

let copied = 0;

if (fs.existsSync(dbPath)) {
  const target = path.join(destination, DB_NAME);
  const db = new Database(dbPath, { readonly: true });

  try {
    // The destination is interpolated into SQL, so double any quotes in it
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }

  fs.chmodSync(target, 0o600);
  console.log(`✓ ${DB_NAME} (consistent copy, WAL included)`);
  copied += 1;
} else {
  console.warn(`! no database at ${dbPath}, skipped`);
}

for (const file of secretFiles) {
  const name = path.basename(file);

  if (!fs.existsSync(file)) {
    console.warn(`! no ${name}, skipped`);
    continue;
  }

  const target = path.join(destination, name);
  fs.copyFileSync(file, target);
  fs.chmodSync(target, 0o600);
  console.log(`✓ ${name}`);
  copied += 1;
}

console.log(`\n${copied} file(s) backed up to ${destination}`);
console.log('These contain your API key and SMTP password, so keep them private.');
