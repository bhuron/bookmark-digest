import { ensureConfig } from '../config.js';
import logger from '../utils/logger.js';

const { apiKey: API_KEY } = ensureConfig();

/**
 * Middleware to validate API key
 */
export function validateApiKey(req, res, next) {
  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    logger.warn('Unauthorized access attempt - Missing API key', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required. Add X-API-Key header to your request.'
    });
  }

  if (apiKey !== API_KEY) {
    logger.warn('Unauthorized access attempt - Invalid API key', {
      ip: req.ip,
      path: req.path,
      apiKeyPrefix: apiKey.substring(0, 8) + '...'
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key. Please check your configuration.'
    });
  }

  next();
}

/**
 * Get API key (for testing/verification)
 */
export function getApiKey() {
  return API_KEY;
}

export default { validateApiKey, getApiKey };
