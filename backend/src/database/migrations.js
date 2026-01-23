import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getConfig } from '../config.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

/**
 * Get database connection for migrations
 */
function getMigrationDb() {
  const dbPath = getConfig('DB_PATH', './data/bookmark-digest.db');
  return new Database(dbPath);
}

/**
 * Run all pending migrations
 */
export function runMigrations() {
  const db = getMigrationDb();

  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create migrations tracking table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get all migration files
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      logger.info('No migrations directory found, skipping migrations');
      db.close();
      return;
    }

    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    logger.info('Found migration files', { count: migrationFiles.length });

    // Get applied migrations
    const appliedMigrations = db.prepare('SELECT name FROM _migrations').all();
    const appliedNames = new Set(appliedMigrations.map(m => m.name));

    // Apply pending migrations
    for (const file of migrationFiles) {
      const migrationName = path.basename(file, '.sql');

      if (!appliedNames.has(migrationName)) {
        logger.info(`Applying migration: ${migrationName}`);

        const migrationPath = path.join(MIGRATIONS_DIR, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Execute migration
        db.exec(migrationSQL);

        // Record migration
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migrationName);

        logger.info(`✓ Migration ${migrationName} applied successfully`);
      } else {
        logger.debug(`⊙ Migration ${migrationName} already applied, skipping`);
      }
    }

    logger.info('All migrations completed');
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    throw error;
  } finally {
    db.close();
  }
}

/**
 * Get migration status
 */
export function getMigrationStatus() {
  const db = getMigrationDb();

  try {
    const applied = db.prepare('SELECT * FROM _migrations ORDER BY applied_at').all();
    return {
      total: applied.length,
      migrations: applied
    };
  } finally {
    db.close();
  }
}

export default { runMigrations, getMigrationStatus };
