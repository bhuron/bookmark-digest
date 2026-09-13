import express from 'express';
import articleProcessor from '../services/articleProcessor.js';
import articleService from '../services/articleService.js';
import { validateRequest, validationRules } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { articleCreationLimiter } from '../middleware/rateLimiter.js';
import logger from '../utils/logger.js';

const router = express.Router();

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
      sort_by = 'created_at'
    } = req.query;

    const { articles, total } = articleService.listArticles({
      page: Number(page),
      limit: Number(limit),
      search,
      is_archived,
      is_favorite,
      sort_by
    });

    res.json({
      data: {
        articles,
        total
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
 * DELETE /api/articles/bulk
 * Delete multiple articles in a single transaction
 * Must be registered before DELETE /:id so "bulk" is not matched as an ID
 */
router.delete('/bulk',
  validationRules.bulkDeleteArticles,
  validateRequest,
  asyncHandler(async (req, res) => {
    // Deduplicate so the reported counts stay accurate
    const ids = [...new Set(req.body.ids.map(Number))];

    const { deleted, imagesRemoved } = await articleService.deleteArticlesByIds(ids);
    const notFound = ids.length - deleted;

    logger.info('Articles bulk deleted', {
      requested: ids.length,
      deleted,
      notFound,
      imagesRemoved
    });

    res.json({
      success: true,
      requested: ids.length,
      deleted,
      notFound,
      imagesRemoved,
      message: `${deleted} article${deleted === 1 ? '' : 's'} deleted`
    });
  })
);

/**
 * DELETE /api/articles/:id
 * Delete article
 */
router.delete('/:id',
  validationRules.articleId,
  validateRequest,
  asyncHandler(async (req, res) => {
    const articleId = Number(req.params.id);

    const { deleted, imagesRemoved } = await articleService.deleteArticlesByIds([articleId]);

    if (deleted === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Article not found'
      });
    }

    logger.info('Article deleted', { articleId, imagesRemoved });

    res.json({
      success: true,
      message: 'Article deleted successfully'
    });
  })
);

export default router;
