import rateLimit from 'express-rate-limit';
import { getConfig } from '../config.js';
import logger from '../utils/logger.js';

/**
 * Check if we're in test mode
 */
function isTestMode() {
  return process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true';
}

/**
 * Create a rate limiter that checks test mode at runtime
 */
function createRateLimiter(options) {
  const limiter = rateLimit(options);
  return (req, res, next) => {
    if (isTestMode()) {
      return next();
    }
    return limiter(req, res, next);
  };
}

/**
 * Rate limiter for API endpoints
 */
export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: getConfig('API_RATE_LIMIT', 100), // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many requests from this IP, please try again later.'
    });
  }
});

/**
 * Stricter rate limiter for expensive operations (EPUB generation)
 */
export const heavyOperationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 EPUB generations per hour
  message: {
    error: 'Too Many Requests',
    message: 'EPUB generation limit reached. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Heavy operation rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'EPUB generation limit reached. Please try again later.'
    });
  }
});

/**
 * Rate limiter for article creation
 */
export const articleCreationLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 articles per minute
  message: {
    error: 'Too Many Requests',
    message: 'Article creation limit reached. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Article creation rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Article creation limit reached. Please slow down.'
    });
  }
});

// Export the createRateLimiter function for testing
export { createRateLimiter };

export default { apiLimiter, heavyOperationLimiter, articleCreationLimiter };
