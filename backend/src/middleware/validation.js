import pkg from 'express-validator';
const { body, param, query, validationResult } = pkg;
import logger from '../utils/logger.js';
import { getMaxArticleBytes, getMaxArticleMb } from '../config.js';

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
 * Target selection shared by the bulk endpoints: either explicit `ids` or a
 * `filter`. Exactly one of the two is required - the routes enforce that, these
 * rules only police the shape.
 */
const articleScopeRules = [
  body('ids')
    .optional()
    .isArray({ min: 1, max: 500 })
    .withMessage('ids must be an array containing 1 to 500 article IDs'),
  body('ids.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each article ID must be a positive integer'),
  body('filter')
    .optional()
    .isObject()
    .withMessage('filter must be an object'),
  body('filter.search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query too long'),
  body('filter.is_archived')
    .optional()
    .isBoolean()
    .withMessage('filter.is_archived must be a boolean'),
  body('filter.is_favorite')
    .optional()
    .isBoolean()
    .withMessage('filter.is_favorite must be a boolean'),
  body('filter.trashed')
    .optional()
    .isBoolean()
    .withMessage('filter.trashed must be a boolean')
];

/**
 * Common validation rules
 */
export const validationRules = {
  // Article validation
  createArticle: [
    body('html')
      .notEmpty()
      .withMessage('HTML content is required')
      // Read the limit per request so MAX_ARTICLE_SIZE_MB is actually honoured
      .custom((value) => typeof value !== 'string' || value.length <= getMaxArticleBytes())
      .withMessage(() => `HTML content too large (max ${getMaxArticleMb()} MB)`),
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
      .withMessage('Search query too long'),

    query('trashed')
      .optional()
      .isIn(['true', 'false'])
      .withMessage('trashed must be true or false')
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

  // Bulk operations. Targets are either explicit ids or a filter.
  bulkDeleteArticles: [...articleScopeRules],

  restoreArticles: [...articleScopeRules],

  purgeArticles: [...articleScopeRules],

  bulkUpdateArticles: [
    ...articleScopeRules,
    body('is_archived')
      .optional()
      .isBoolean()
      .withMessage('is_archived must be a boolean'),
    body('is_favorite')
      .optional()
      .isBoolean()
      .withMessage('is_favorite must be a boolean')
  ],

  // SMTP settings validation
  updateSmtpSettings: [
    body('kindleEmail')
      .trim()
      .isEmail()
      .withMessage('Valid Kindle email required'),
    body('smtpHost')
      .trim()
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
      .trim()
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
      .trim()
      .custom(value => !value || value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      .withMessage('Valid from email required')
  ]
};

export default { validateRequest, validationRules };
