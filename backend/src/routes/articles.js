import express from 'express';
import articleProcessor from '../services/articleProcessor.js';
import articleService from '../services/articleService.js';
import { validateRequest, validationRules } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { articleCreationLimiter } from '../middleware/rateLimiter.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Read the target selection from a bulk request body.
 *
 * Callers supply either explicit `ids` or a `filter` that selects the whole
 * matching set server-side, which is what makes "select all matching" work
 * across pages without shipping thousands of ids.
 *
 * @param {Object} req - Express request
 * @returns {{scope?: Object, error?: string}}
 */
function readScope(req) {
  const { ids, filter } = req.body || {};
  const hasIds = Array.isArray(ids) && ids.length > 0;

  if (hasIds && filter) {
    return { error: 'Provide either ids or filter, not both' };
  }

  if (!hasIds && !filter) {
    return { error: 'Provide ids or filter' };
  }

  return {
    scope: {
      ids: hasIds ? [...new Set(ids.map(Number))] : undefined,
      filter: filter || undefined
    }
  };
}

/**
 * POST /api/articles
 * Create a new article from HTML
 */
router.post('/',
  articleCreationLimiter,
  validationRules.createArticle,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { html, url } = req.body;

    logger.info('Creating article', { url });

    // Process article
    const processed = await articleProcessor.processArticle(html, url, {
      preserveImages: true
    });

    if (!processed.success) {
      // Save failed attempt for review
      await articleProcessor.saveFailedArticle(url, processed.error, html);

      return res.status(400).json({
        error: 'Failed to process article',
        message: processed.error
      });
    }

    // Save to database
    const articleId = await articleProcessor.saveArticle(processed);

    res.status(201).json({
      success: true,
      article: {
        id: articleId,
        url: processed.url,
        title: processed.title,
        excerpt: processed.excerpt,
        wordCount: processed.wordCount,
        readingTimeMinutes: processed.readingTimeMinutes,
        hasImages: processed.hasImages,
        imageCount: processed.imageCount
      }
    });
  })
);

/**
 * POST /api/articles/restore
 * Move trashed articles back into the library
 */
router.post('/restore',
  validationRules.restoreArticles,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { scope, error } = readScope(req);

    if (error) {
      return res.status(400).json({ error: 'Bad Request', message: error });
    }

    const { restored } = articleService.restoreArticles(scope);

    logger.info('Articles restored', { restored });

    res.json({
      success: true,
      restored,
      message: `${restored} article${restored === 1 ? '' : 's'} restored`
    });
  })
);

/**
 * GET /api/articles
 * List articles with pagination and filters
 */
router.get('/',
  validationRules.listArticles,
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      search,
      is_archived,
      is_favorite,
      sort_by = 'created_at',
      trashed
    } = req.query;

    const { articles, total, trashedTotal } = articleService.listArticles({
      page: Number(page),
      limit: Number(limit),
      search,
      is_archived,
      is_favorite,
      sort_by,
      trashed: trashed === 'true'
    });

    res.json({
      data: {
        articles,
        total,
        trashedTotal
      }
    });
  })
);

/**
 * GET /api/articles/stats
 * Get statistics
 */
router.get('/stats',
  asyncHandler(async (req, res) => {
    res.json(articleService.getStats());
  })
);

/**
 * PUT /api/articles/bulk
 * Apply archive/favourite flags to many articles
 * Must be registered before PUT /:id so "bulk" is not matched as an ID
 */
router.put('/bulk',
  validationRules.bulkUpdateArticles,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { is_archived, is_favorite } = req.body;

    if (is_archived === undefined && is_favorite === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Provide is_archived or is_favorite'
      });
    }

    const { scope, error } = readScope(req);

    if (error) {
      return res.status(400).json({ error: 'Bad Request', message: error });
    }

    const { updated } = articleService.bulkUpdateArticles(scope, { is_archived, is_favorite });

    logger.info('Articles bulk updated', { updated, is_archived, is_favorite });

    res.json({
      success: true,
      updated,
      message: `${updated} article${updated === 1 ? '' : 's'} updated`
    });
  })
);

/**
 * DELETE /api/articles/bulk
 * Move many articles to the trash
 * Must be registered before DELETE /:id so "bulk" is not matched as an ID
 */
router.delete('/bulk',
  validationRules.bulkDeleteArticles,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { scope, error } = readScope(req);

    if (error) {
      return res.status(400).json({ error: 'Bad Request', message: error });
    }

    const { deleted, requested, notFound } = articleService.softDeleteArticles(scope);

    logger.info('Articles moved to trash', { requested, deleted, notFound });

    res.json({
      success: true,
      requested,
      deleted,
      notFound,
      message: `${deleted} article${deleted === 1 ? '' : 's'} moved to trash`
    });
  })
);

/**
 * DELETE /api/articles/purge
 * Permanently delete trashed articles and their images
 */
router.delete('/purge',
  validationRules.purgeArticles,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { scope, error } = readScope(req);

    if (error) {
      return res.status(400).json({ error: 'Bad Request', message: error });
    }

    const { purged, imagesRemoved } = await articleService.purgeArticles(scope);

    logger.info('Articles purged', { purged, imagesRemoved });

    res.json({
      success: true,
      purged,
      imagesRemoved,
      message: `${purged} article${purged === 1 ? '' : 's'} permanently deleted`
    });
  })
);

/**
 * GET /api/articles/:id
 * Get single article by ID
 */
router.get('/:id',
  validationRules.articleId,
  validateRequest,
  asyncHandler(async (req, res) => {
    const article = articleService.getArticleById(req.params.id);

    if (!article) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Article not found'
      });
    }

    res.json({ article });
  })
);

/**
 * PUT /api/articles/:id
 * Update article
 */
router.put('/:id',
  validationRules.articleId,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, is_archived, is_favorite } = req.body;

    const { found, updated } = articleService.updateArticle(id, {
      title,
      is_archived,
      is_favorite
    });

    if (!found) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Article not found'
      });
    }

    if (!updated) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }

    logger.info('Article updated', { articleId: id });

    res.json({
      success: true,
      message: 'Article updated successfully'
    });
  })
);

/**
 * DELETE /api/articles/:id
 * Move an article to the trash
 */
router.delete('/:id',
  validationRules.articleId,
  validateRequest,
  asyncHandler(async (req, res) => {
    const articleId = Number(req.params.id);

    const { deleted } = articleService.softDeleteArticles({ ids: [articleId] });

    if (deleted === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Article not found'
      });
    }

    logger.info('Article moved to trash', { articleId });

    res.json({
      success: true,
      message: 'Article moved to trash'
    });
  })
);

export default router;
