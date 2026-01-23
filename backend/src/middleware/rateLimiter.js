import rateLimit from 'express-rate-limit';
import { getConfig } from '../config.js';
import logger from '../utils/logger.js';

/**
 * Rate limiter for API endpoints
 */
export const apiLimiter = rateLimit({
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
export const heavyOperationLimiter = rateLimit({
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
export const articleCreationLimiter = rateLimit({
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

export default { apiLimiter, heavyOperationLimiter, articleCreationLimiter };
