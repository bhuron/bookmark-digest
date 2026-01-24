import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import fs from 'fs';

// Set test mode before importing any modules
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';

import { closeConnection, initializeDatabase } from '../../database/index.js';
import { ensureConfig } from '../../config.js';
import { validateApiKey } from '../../middleware/auth.js';
import { errorHandler } from '../../middleware/errorHandler.js';

// Import routes
import articlesRouter from '../../routes/articles.js';
import epubRouter from '../../routes/epub.js';
import settingsRouter from '../../routes/settings.js';

// Store test API key
let testApiKey = null;

/**
 * Create Express app for testing
 */
export function createTestApp() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check (no auth required)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes with authentication
  app.use('/api/articles', validateApiKey, articlesRouter);
  app.use('/api/epub', validateApiKey, epubRouter);
  app.use('/api/settings', validateApiKey, settingsRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}

/**
 * Setup test database
 */
export async function setupTestDatabase() {
  // Use test database with unique suffix to avoid conflicts between test files
  const testId = process.env.TEST_ID || 'integration';
  process.env.DB_PATH = `./data/test-${testId}.db`;

  // Close any existing connection
  closeConnection();

  // Initialize fresh database
  await initializeDatabase();

  // Store the API key that was generated for this test database
  const config = ensureConfig();
  testApiKey = config.apiKey;
}

/**
 * Cleanup test database
 */
export function cleanupTestDatabase() {
  try {
    closeConnection();
    const testId = process.env.TEST_ID || 'integration';
    const testDbPath = `./data/test-${testId}.db`;
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Reset test database between test suites
 */
export async function resetTestDatabase() {
  const { getConnection } = await import('../../database/index.js');
  const db = getConnection();

  try {
    db.exec('DELETE FROM epub_exports');
    db.exec('DELETE FROM article_images');
    db.exec('DELETE FROM articles');
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Get the test API key
 */
export function getTestApiKey() {
  return testApiKey;
}

/**
 * Create authenticated request headers
 */
export function createAuthHeaders() {
  return {
    'X-API-Key': testApiKey,
    'Content-Type': 'application/json'
  };
}
