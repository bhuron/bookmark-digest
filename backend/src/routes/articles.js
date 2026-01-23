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
    const { html, url, tags } = req.body;

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
    const articleId = await articleProcessor.saveArticle(processed, tags || []);

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
    const { page = 1, limit = 20, tag, search, is_archived, is_favorite } = req.query;
    const offset = (page - 1) * limit;

    const db = getConnection();

    // Build WHERE clause
    let whereConditions = ['a.capture_success = 1'];
    const params = [];

    if (tag) {
      whereConditions.push('t.name = ?');
      params.push(tag);
    }

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

    // Fetch articles
    const articles = db.prepare(`
      SELECT DISTINCT a.*,
        GROUP_CONCAT(t.name) as tags
      FROM articles a
      LEFT JOIN article_tags at ON a.id = at.article_id
      LEFT JOIN tags t ON at.tag_id = t.id
      WHERE ${whereClause}
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // Get count
    const countResult = db.prepare(`
      SELECT COUNT(DISTINCT a.id) as total
      FROM articles a
      LEFT JOIN article_tags at ON a.id = at.article_id
      LEFT JOIN tags t ON at.tag_id = t.id
      WHERE ${whereClause}
    `).get(...params);

    // Parse tags for each article
    const articlesWithTags = articles.map(article => ({
      ...article,
      tags: article.tags ? article.tags.split(',') : [],
      has_images: Boolean(article.has_images),
      is_archived: Boolean(article.is_archived),
      is_favorite: Boolean(article.is_favorite)
    }));

    res.json({
      articles: articlesWithTags,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit)
      }
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
      SELECT a.*,
        GROUP_CONCAT(t.name) as tags
      FROM articles a
      LEFT JOIN article_tags at ON a.id = at.article_id
      LEFT JOIN tags t ON at.tag_id = t.id
      WHERE a.id = ?
      GROUP BY a.id
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
        tags: article.tags ? article.tags.split(',') : [],
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

/**
 * POST /api/articles/:id/tags
 * Add tags to article
 */
router.post('/:id/tags',
  validationRules.articleId,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tags must be a non-empty array'
      });
    }

    const db = getConnection();

    // Check if article exists
    const existing = db.prepare('SELECT id FROM articles WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Article not found'
      });
    }

    // Add tags
    const tagInsertStmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const tagGetStmt = db.prepare('SELECT id FROM tags WHERE name = ?');
    const articleTagStmt = db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)');

    for (const tagName of tags) {
      const cleanTag = tagName.trim().toLowerCase();
      if (!cleanTag) continue;

      tagInsertStmt.run(cleanTag);
      const tagResult = tagGetStmt.get(cleanTag);

      if (tagResult) {
        articleTagStmt.run(id, tagResult.id);
      }
    }

    logger.info('Tags added to article', { articleId: id, tags });

    res.json({
      success: true,
      message: 'Tags added successfully'
    });
  })
);

/**
 * DELETE /api/articles/:id/tags/:tagId
 * Remove tag from article
 */
router.delete('/:id/tags/:tagId',
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id, tagId } = req.params;
    const db = getConnection();

    const result = db.prepare(`
      DELETE FROM article_tags
      WHERE article_id = ? AND tag_id = ?
    `).run(id, tagId);

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tag not found on article'
      });
    }

    logger.info('Tag removed from article', { articleId: id, tagId });

    res.json({
      success: true,
      message: 'Tag removed successfully'
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
        SUM(CASE WHEN has_images = 1 THEN 1 ELSE 0 END) as articles_with_images,
        SUM(word_count) as total_words,
        SUM(reading_time_minutes) as total_reading_time
      FROM articles
      WHERE capture_success = 1
    `).get();

    const tagStats = db.prepare(`
      SELECT t.name, COUNT(at.article_id) as article_count
      FROM tags t
      LEFT JOIN article_tags at ON t.id = at.tag_id
      GROUP BY t.id
      ORDER BY article_count DESC
      LIMIT 20
    `).all();

    res.json({
      stats,
      popularTags: tagStats
    });
  })
);

export default router;
