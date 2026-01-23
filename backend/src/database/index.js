import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getConfig } from '../config.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection singleton
let db = null;

/**
 * Get database connection (singleton pattern)
 */
export function getConnection() {
  if (!db) {
    const dbPath = getConfig('DB_PATH', './data/bookmark-digest.db');

    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.info('Created data directory', { path: dataDir });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    logger.info('Database connection established', { path: dbPath });
  }

  return db;
}

/**
 * Close database connection
 */
export function closeConnection() {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

/**
 * Initialize database (run migrations)
 */
export async function initializeDatabase() {
  const { runMigrations } = await import('./migrations.js');
  runMigrations();
  logger.info('Database initialized');
}

// Graceful shutdown
process.on('exit', () => {
  closeConnection();
});

process.on('SIGINT', () => {
  closeConnection();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeConnection();
  process.exit(0);
});

export default { getConnection, closeConnection, initializeDatabase };
