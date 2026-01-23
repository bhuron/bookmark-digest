import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { getConfig } from './config.js';
import logger from './utils/logger.js';
import { validateApiKey } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { initializeDatabase } from './database/index.js';

// Import routes
import articlesRouter from './routes/articles.js';
import epubRouter from './routes/epub.js';
import tagsRouter from './routes/tags.js';

const app = express();
const PORT = getConfig('PORT', 3000);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  hsts: false // Disable for localhost
}));

// CORS configuration
const corsOrigin = getConfig('CORS_ORIGIN', 'http://localhost:5173');
app.use(cors({
  origin: [corsOrigin, 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
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

// API routes with authentication
app.use('/api/articles', validateApiKey, apiLimiter, articlesRouter);
app.use('/api/epub', validateApiKey, apiLimiter, epubRouter);
app.use('/api/tags', validateApiKey, apiLimiter, tagsRouter);

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
