import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from './config.js';
import logger from './utils/logger.js';
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Try to load Kindle configuration from database if not configured from environment
if (!kindleService.isConfigured()) {
  try {
    const smtpSettings = settingsService.getSmtpSettings();
    if (settingsService.isSmtpConfigured()) {
      kindleService.configure(smtpSettings);
      logger.info('Kindle service configured from database settings');
    } else {
      logger.info('Kindle service not configured - waiting for SMTP settings via API');
    }
  } catch (error) {
    logger.warn('Failed to load Kindle configuration from database', {
      error: error.message
    });
  }
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
