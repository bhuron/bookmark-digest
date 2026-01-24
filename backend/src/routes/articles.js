import express from 'express';
import articleProcessor from '../services/articleProcessor.js';
import { validateRequest, validationRules } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { articleCreationLimiter } from '../middleware/rateLimiter.js';
import { getConnection } from '../database/index.js';
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
    const { page = 1, limit = 20, search, is_archived, is_favorite, sort_by = 'created_at' } = req.query;
    const offset = (page - 1) * limit;

    const db = getConnection();

    // Build WHERE clause
    let whereConditions = ['a.capture_success = 1'];
    const params = [];



    if (search) {
      whereConditions.push('(a.title LIKE ? OR a.content_text LIKE ? OR a.excerpt LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (is_archived !== undefined) {
      whereConditions.push('a.is_archived = ?');
      params.push(is_archived === 'true' ? 1 : 0);
    }

    if (is_favorite !== undefined) {
      whereConditions.push('a.is_favorite = ?');
      params.push(is_favorite === 'true' ? 1 : 0);
    }

    const whereClause = whereConditions.join(' AND ');

    // Build ORDER BY clause
    let orderBy = 'a.created_at DESC';
    switch (sort_by) {
      case 'created_at_asc':
        orderBy = 'a.created_at ASC';
        break;
      case 'title':
        orderBy = 'a.title ASC';
        break;
      case 'title_desc':
        orderBy = 'a.title DESC';
        break;
      case 'reading_time':
        orderBy = 'a.reading_time_minutes ASC';
        break;
      case 'created_at':
      default:
        orderBy = 'a.created_at DESC';
        break;
    }

    // Fetch articles
    const articles = db.prepare(`
      SELECT a.*
      FROM articles a
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // Get count
    const countResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM articles a
      WHERE ${whereClause}
    `).get(...params);

    const articlesWithMetadata = articles.map(article => ({
      ...article,
      has_images: Boolean(article.has_images),
      is_archived: Boolean(article.is_archived),
      is_favorite: Boolean(article.is_favorite)
    }));

    res.json({
      data: {
        articles: articlesWithMetadata,
        total: countResult.total
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
    const db = getConnection();

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_articles,
        SUM(CASE WHEN is_archived = 1 THEN 1 ELSE 0 END) as archived_articles,
        SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as favorite_articles,
        SUM(CASE WHEN is_archived = 0 THEN 1 ELSE 0 END) as unread_articles,
        SUM(CASE WHEN has_images = 1 THEN 1 ELSE 0 END) as articles_with_images,
        SUM(word_count) as total_words,
        SUM(reading_time_minutes) as total_reading_time
      FROM articles
      WHERE capture_success = 1
    `).get();



    res.json({
      total_articles: stats.total_articles || 0,
      archived_articles: stats.archived_articles || 0,
      favorite_articles: stats.favorite_articles || 0,
      unread_articles: stats.unread_articles || 0,
      articles_with_images: stats.articles_with_images || 0,
      total_words: stats.total_words || 0,
      total_reading_time: stats.total_reading_time || 0
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
    const { id } = req.params;
    const db = getConnection();

    const article = db.prepare(`
      SELECT a.*
      FROM articles a
      WHERE a.id = ?
    `).get(id);

    if (!article) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Article not found'
      });
    }

    res.json({
      article: {
        ...article,
        has_images: Boolean(article.has_images),
        is_archived: Boolean(article.is_archived),
        is_favorite: Boolean(article.is_favorite)
      }
    });
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
    const db = getConnection();

    // Check if article exists
    const existing = db.prepare('SELECT id FROM articles WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Article not found'
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (is_archived !== undefined) {
      updates.push('is_archived = ?');
      params.push(is_archived ? 1 : 0);
    }
    if (is_favorite !== undefined) {
      updates.push('is_favorite = ?');
      params.push(is_favorite ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }

    params.push(id);
    const updateStmt = db.prepare(`
      UPDATE articles SET ${updates.join(', ')}
      WHERE id = ?
    `);

    updateStmt.run(...params);

    logger.info('Article updated', { articleId: id, updates: updates.join(', ') });

    res.json({
      success: true,
      message: 'Article updated successfully'
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
    const { id } = req.params;
    const db = getConnection();

    const result = db.prepare('DELETE FROM articles WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Article not found'
      });
    }

    logger.info('Article deleted', { articleId: id });

    res.json({
      success: true,
      message: 'Article deleted successfully'
    });
  })
);





export default router;
