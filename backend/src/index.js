import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getArticleBodyLimit, getConfig, validateConfig } from './config.js';
import logger from './utils/logger.js';
import { isSpaRoute } from './utils/spaRoutes.js';
import { validateApiKey } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { initializeDatabase } from './database/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import articlesRouter from './routes/articles.js';
import epubRouter from './routes/epub.js';

import settingsRouter from './routes/settings.js';

// Import services
import kindleService from './services/kindleService.js';
import settingsService from './services/settingsService.js';

// Validate configuration before serving anything, so a typo in .env fails
// loudly at boot instead of silently falling back to a default
try {
  validateConfig();
} catch (error) {
  console.error(`\n✗ ${error.message}\n`);
  process.exit(1);
}

const app = express();
const PORT = getConfig('PORT', 3000);

// CORS configuration (must come before other middleware)
const corsOrigin = getConfig('CORS_ORIGIN', 'http://localhost:5174');
app.use(cors({
  origin: [corsOrigin, 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Security middleware (configure to not interfere with CORS)
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  hsts: false // Disable for localhost
}));

// Body parsing middleware
app.use(express.json({ limit: getArticleBodyLimit() }));
app.use(express.urlencoded({ extended: true, limit: getArticleBodyLimit() }));

// Compression middleware
app.use(compression());

// Request logging middleware
app.use((req, res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'bookmark-digest',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Serve static images (no auth required for images)
const imagesDir = path.join(__dirname, '../images');
app.use('/images', express.static(imagesDir));

// API routes with authentication
app.use('/api/articles', validateApiKey, apiLimiter, articlesRouter);
app.use('/api/epub', validateApiKey, apiLimiter, epubRouter);

app.use('/api/settings', validateApiKey, apiLimiter, settingsRouter);

// API status endpoint (with auth)
app.get('/api/status', validateApiKey, (req, res) => {
  res.json({
    service: 'bookmark-digest',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Serve the built frontend when it exists, so a production install runs as a
// single process on one port. Development uses the Vite dev server instead, so
// this is skipped until the frontend has been built.
const frontendDist = path.join(__dirname, '../../frontend/dist');
const frontendIndex = path.join(frontendDist, 'index.html');

if (fs.existsSync(frontendIndex)) {
  app.use(express.static(frontendDist, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        // The shell must be revalidated, or clients pin an old bundle
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        // Vite fingerprints asset filenames, so those can be cached hard
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));

  // Client-side routes fall back to the shell; server paths keep their JSON 404
  app.get('*', (req, res, next) => {
    if (!isSpaRoute(req.path)) {
      return next();
    }

    res.sendFile(frontendIndex);
  });

  logger.info('Serving built frontend', { path: frontendDist });
} else {
  logger.info('No frontend build found - run "npm run build" in frontend/ to serve the UI from this server');
}

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Initialize database
try {
  initializeDatabase();
  logger.info('Database initialized successfully');
} catch (error) {
  logger.error('Failed to initialize database', { error: error.message });
  process.exit(1);
}

// Try to load Kindle configuration from database first, then fall back to environment
try {
  const smtpSettings = settingsService.getSmtpSettings();
  if (settingsService.isSmtpConfigured()) {
    kindleService.configure(smtpSettings);
    logger.info('Kindle service configured from database settings');
  } else {
    // Database not configured, try loading from environment
    const loadedFromEnv = kindleService.loadFromEnv();
    if (!loadedFromEnv) {
      logger.info('Kindle service not configured - waiting for SMTP settings via API');
    }
  }
} catch (error) {
  logger.warn('Failed to load Kindle configuration from database, trying environment', {
    error: error.message
  });
  // Fall back to environment variables
  kindleService.loadFromEnv();
}

// Start server
app.listen(PORT, () => {
  logger.info(`Server started`, {
    port: PORT,
    environment: getConfig('NODE_ENV', 'development'),
    cors: corsOrigin
  });
  console.log(`\n========================================`);
  console.log(`  🚀 Bookmark Digest Server`);
  console.log(`========================================`);
  console.log(`  Server: http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Status: http://localhost:${PORT}/api/status`);
  console.log(`========================================\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
