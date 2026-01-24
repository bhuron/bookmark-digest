import pkg from 'express-validator';
const { body, param, query, validationResult } = pkg;
import logger from '../utils/logger.js';

/**
 * Validation middleware
 * Checks for validation errors and returns 400 if found
 */
export function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      errors: errors.array(),
      path: req.path
    });
    return res.status(400).json({
      error: 'Validation Error',
      details: errors.array()
    });
  }
  next();
}

/**
 * Common validation rules
 */
export const validationRules = {
  // Article validation
  createArticle: [
    body('html')
      .notEmpty()
      .withMessage('HTML content is required')
      .isLength({ max: 10000000 })
      .withMessage('HTML content too large (max 10MB)'),
    body('url')
      .isURL()
      .withMessage('Valid URL is required')
      .isLength({ max: 2048 })
      .withMessage('URL too long'),
    body('title')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Title too long'),

  ],

  // Article ID parameter
  articleId: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Valid article ID required')
  ],

  // Pagination and filtering
  listArticles: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),

    query('search')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Search query too long')
  ],

  // EPUB generation
  generateEpub: [
    body('articleIds')
      .isArray()
      .withMessage('articleIds must be an array')
      .custom((value) => value.length > 0)
      .withMessage('At least one article ID required')
      .custom((value) => value.length <= 100)
      .withMessage('Maximum 100 articles per EPUB'),
    body('articleIds.*')
      .isInt({ min: 1 })
      .withMessage('Each article ID must be a positive integer'),
    body('title')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be 1-200 characters'),
    body('author')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Author must be 1-100 characters')
  ],

  // SMTP settings validation
  updateSmtpSettings: [
    body('kindleEmail')
      .isEmail()
      .withMessage('Valid Kindle email required'),
    body('smtpHost')
      .notEmpty()
      .withMessage('SMTP host is required')
      .isString()
      .isLength({ max: 255 })
      .withMessage('SMTP host too long'),
    body('smtpPort')
      .optional()
      .isInt({ min: 1, max: 65535 })
      .withMessage('Valid port number required (1-65535)'),
    body('smtpSecure')
      .optional()
      .custom(value => value === 'true' || value === 'false' || value === true || value === false)
      .withMessage('SMTP secure must be true or false'),
    body('smtpUser')
      .notEmpty()
      .withMessage('SMTP username is required')
      .isString()
      .isLength({ max: 255 })
      .withMessage('SMTP username too long'),
    body('smtpPassword')
      .notEmpty()
      .withMessage('SMTP password is required')
      .isString()
      .isLength({ max: 255 })
      .withMessage('SMTP password too long'),
    body('fromEmail')
      .optional()
      .isEmail()
      .withMessage('Valid from email required')
  ]
};

export default { validateRequest, validationRules };
