import { body, param, query, validationResult } from 'express-validator';
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
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Each tag must be 1-50 characters')
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
    query('tag')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Tag filter invalid'),
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
  ]
};

export default { validateRequest, validationRules };
