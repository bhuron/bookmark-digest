import express from 'express';
import { validateRequest, validationRules } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getConnection } from '../database/index.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/tags
 * List all tags
 */
router.get('/',
  asyncHandler(async (req, res) => {
    const db = getConnection();

    const tags = db.prepare(`
      SELECT t.*,
        COUNT(at.article_id) as article_count
      FROM tags t
      LEFT JOIN article_tags at ON t.id = at.tag_id
      GROUP BY t.id
      ORDER BY article_count DESC, t.name ASC
    `).all();

    res.json({
      tags: tags.map(tag => ({
        ...tag,
        article_count: tag.article_count
      }))
    });
  })
);

/**
 * POST /api/tags
 * Create new tag
 */
router.post('/',
  validateRequest,
  asyncHandler(async (req, res) => {
    const { name, color } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tag name is required'
      });
    }

    const cleanName = name.trim().toLowerCase();
    if (!cleanName) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tag name cannot be empty'
      });
    }

    const db = getConnection();

    try {
      const stmt = db.prepare(`
        INSERT INTO tags (name, color)
        VALUES (?, ?)
        RETURNING id
      `);

      const result = stmt.get(cleanName, color || '#6B7280');

      logger.info('Tag created', { tagId: result.id, name: cleanName });

      res.status(201).json({
        success: true,
        tag: {
          id: result.id,
          name: cleanName,
          color: color || '#6B7280'
        }
      });
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Tag already exists'
        });
      }
      throw error;
    }
  })
);

/**
 * PUT /api/tags/:id
 * Update tag
 */
router.put('/:id',
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, color } = req.body;
    const db = getConnection();

    // Check if tag exists
    const existing = db.prepare('SELECT id FROM tags WHERE id = ?').get(parseInt(id));
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tag not found'
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      const cleanName = name.trim().toLowerCase();
      if (!cleanName) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tag name cannot be empty'
        });
      }
      updates.push('name = ?');
      params.push(cleanName);
    }

    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }

    params.push(parseInt(id));

    try {
      const updateStmt = db.prepare(`
        UPDATE tags SET ${updates.join(', ')}
        WHERE id = ?
      `);

      updateStmt.run(...params);

      logger.info('Tag updated', { tagId: id, updates: updates.join(', ') });

      res.json({
        success: true,
        message: 'Tag updated successfully'
      });
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Tag name already exists'
        });
      }
      throw error;
    }
  })
);

/**
 * DELETE /api/tags/:id
 * Delete tag
 */
router.delete('/:id',
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getConnection();

    const result = db.prepare('DELETE FROM tags WHERE id = ?').run(parseInt(id));

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tag not found'
      });
    }

    logger.info('Tag deleted', { tagId: id });

    res.json({
      success: true,
      message: 'Tag deleted successfully'
    });
  })
);

/**
 * GET /api/tags/:id/articles
 * Get articles with tag
 */
router.get('/:id/articles',
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const db = getConnection();

    // Check if tag exists
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(parseInt(id));
    if (!tag) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tag not found'
      });
    }

    const articles = db.prepare(`
      SELECT a.*
      FROM articles a
      INNER JOIN article_tags at ON a.id = at.article_id
      WHERE at.tag_id = ? AND a.capture_success = 1
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(parseInt(id), parseInt(limit), parseInt(offset));

    const countResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM articles a
      INNER JOIN article_tags at ON a.id = at.article_id
      WHERE at.tag_id = ? AND a.capture_success = 1
    `).get(parseInt(id));

    res.json({
      tag,
      articles,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: countResult.total
      }
    });
  })
);

export default router;
