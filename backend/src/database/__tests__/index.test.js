import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { getConnection, closeConnection, initializeDatabase } from '../index.js';

describe('Database Operations', () => {
  const testDbPath = './data/test-bookmark-digest.db';

  beforeEach(() => {
    // Close any existing connections
    closeConnection();
  });

  afterEach(() => {
    // Clean up test database
    closeConnection();
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('getConnection', () => {
    it('should export getConnection function', () => {
      expect(getConnection).toBeDefined();
      expect(typeof getConnection).toBe('function');
    });

    it('should establish database connection', () => {
      // Set environment variable for test database
      process.env.DB_PATH = testDbPath;

      const db = getConnection();

      expect(db).toBeDefined();
      expect(db).toHaveProperty('prepare');
      expect(db).toHaveProperty('exec');
      expect(db).toHaveProperty('pragma');
    });

    it('should return same connection on subsequent calls (singleton)', () => {
      process.env.DB_PATH = testDbPath;

      const db1 = getConnection();
      const db2 = getConnection();

      expect(db1).toBe(db2);
    });

    it('should create data directory if it does not exist', () => {
      const testDir = './data-test-temp';
      process.env.DB_PATH = path.join(testDir, 'test.db');

      // Remove directory if it exists
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }

      const db = getConnection();

      expect(fs.existsSync(testDir)).toBe(true);

      // Cleanup
      closeConnection();
      fs.rmSync(testDir, { recursive: true, force: true });
    });
  });

  describe('closeConnection', () => {
    it('should export closeConnection function', () => {
      expect(closeConnection).toBeDefined();
      expect(typeof closeConnection).toBe('function');
    });

    it('should close database connection', () => {
      process.env.DB_PATH = testDbPath;

      const db = getConnection();
      expect(db).toBeDefined();

      closeConnection();

      // After closing, getConnection should create a new connection
      const db2 = getConnection();
      expect(db2).toBeDefined();
      // db2 should be a different connection object
      expect(db2).not.toBe(db);
    });

    it('should handle closing when no connection exists', () => {
      // Should not throw when connection is already closed
      expect(() => {
        closeConnection();
        closeConnection(); // Call twice
      }).not.toThrow();
    });
  });

  describe('initializeDatabase', () => {
    it('should export initializeDatabase function', () => {
      expect(initializeDatabase).toBeDefined();
      expect(typeof initializeDatabase).toBe('function');
    });

    it('should initialize database without throwing', async () => {
      process.env.DB_PATH = testDbPath;

      await expect(initializeDatabase()).resolves.not.toThrow();
    });

    it('should create migrations table after initialization', async () => {
      process.env.DB_PATH = testDbPath;

      await initializeDatabase();
      const db = getConnection();

      // Check if migrations table exists
      const tableInfo = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'"
      ).get();

      expect(tableInfo).toBeDefined();
    });
  });

  describe('Database Pragmas', () => {
    it('should enable WAL mode', () => {
      process.env.DB_PATH = testDbPath;

      const db = getConnection();
      const walMode = db.pragma('journal_mode', { simple: true });

      expect(walMode).toBe('wal');
    });

    it('should enable foreign keys', () => {
      process.env.DB_PATH = testDbPath;

      const db = getConnection();
      const foreignKeys = db.pragma('foreign_keys', { simple: true });

      expect(foreignKeys).toBe(1);
    });
  });

  describe('Basic Database Operations', () => {
    beforeEach(async () => {
      process.env.DB_PATH = testDbPath;
      await initializeDatabase();
    });

    it('should support prepared statements', () => {
      const db = getConnection();

      const stmt = db.prepare('SELECT 1 as result');
      const result = stmt.get();

      expect(result).toHaveProperty('result', 1);
    });

    it('should support transactions', () => {
      const db = getConnection();

      const result = db.transaction(() => {
        const stmt = db.prepare('SELECT 1 as value');
        return stmt.get();
      })();

      expect(result).toHaveProperty('value', 1);
    });

    it('should support exec for multiple statements', () => {
      const db = getConnection();

      expect(() => {
        db.exec('CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY);');
      }).not.toThrow();

      // Verify table was created
      const tableInfo = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'"
      ).get();

      expect(tableInfo).toBeDefined();
    });
  });

  describe('Process Signal Handlers', () => {
    it('should register process exit handler', () => {
      // Check that the process has listeners for exit
      const exitListeners = process.listenerCount('exit');
      expect(exitListeners).toBeGreaterThan(0);
    });

    it('should register SIGINT handler', () => {
      const sigintListeners = process.listenerCount('SIGINT');
      expect(sigintListeners).toBeGreaterThan(0);
    });

    it('should register SIGTERM handler', () => {
      const sigtermListeners = process.listenerCount('SIGTERM');
      expect(sigtermListeners).toBeGreaterThan(0);
    });
  });

  describe('Default Export', () => {
    it('should have default export object', async () => {
      const databaseModule = await import('../index.js');
      expect(databaseModule.default).toBeDefined();
      expect(databaseModule.default).toHaveProperty('getConnection');
      expect(databaseModule.default).toHaveProperty('closeConnection');
      expect(databaseModule.default).toHaveProperty('initializeDatabase');
    });
  });
});
