import express from 'express';
import epubGenerator from '../services/epubGenerator.js';
import { validateRequest, validationRules } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { heavyOperationLimiter } from '../middleware/rateLimiter.js';
import { getConnection } from '../database/index.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

/**
 * POST /api/epub/generate
 * Generate EPUB from selected articles
 */
router.post('/generate',
  heavyOperationLimiter,
  validationRules.generateEpub,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { articleIds, title, author } = req.body;

    logger.info('EPUB generation requested', {
      articleCount: articleIds.length,
      title
    });

    const result = await epubGenerator.generateFromArticles(articleIds, {
      title,
      author
    });

    res.status(201).json({
      success: true,
      epub: result
    });
  })
);

/**
 * GET /api/epub/exports
 * List EPUB exports
 */
router.get('/exports',
  asyncHandler(async (req, res) => {
    const { limit = 50 } = req.query;

    const exports = epubGenerator.listExports(parseInt(limit));

    res.json({
      exports
    });
  })
);

/**
 * GET /api/epub/exports/:id
 * Get single export details
 */
router.get('/exports/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const exportRecord = epubGenerator.getExport(parseInt(id));
      res.json({ export: exportRecord });
    } catch (error) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }
  })
);

/**
 * GET /api/epub/exports/:id/download
 * Download EPUB file
 */
router.get('/exports/:id/download',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const exportRecord = epubGenerator.getExport(parseInt(id));

      // Check if file exists
      try {
        await fs.access(exportRecord.file_path);
      } catch {
        return res.status(404).json({
          error: 'Not Found',
          message: 'EPUB file not found on disk'
        });
      }

      // Send file
      res.download(exportRecord.file_path, exportRecord.name + '.epub', (err) => {
        if (err) {
          logger.error('EPUB download failed', {
            exportId: id,
            error: err.message
          });
        }
      });

      logger.info('EPUB downloaded', { exportId: id });
    } catch (error) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }
  })
);

/**
 * DELETE /api/epub/exports/:id
 * Delete EPUB export
 */
router.delete('/exports/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getConnection();

    // Get export record
    const exportRecord = db.prepare('SELECT * FROM epub_exports WHERE id = ?').get(parseInt(id));

    if (!exportRecord) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Export not found'
      });
    }

    // Delete file
    try {
      await fs.unlink(exportRecord.file_path);
      logger.info('EPUB file deleted', { path: exportRecord.file_path });
    } catch (error) {
      logger.warn('Failed to delete EPUB file', {
        path: exportRecord.file_path,
        error: error.message
      });
    }

    // Delete database record
    db.prepare('DELETE FROM epub_exports WHERE id = ?').run(parseInt(id));

    logger.info('EPUB export deleted', { exportId: id });

    res.json({
      success: true,
      message: 'EPUB export deleted successfully'
    });
  })
);

/**
 * POST /api/epub/exports/:id/send-to-kindle
 * Send EPUB to Kindle via email
 */
router.post('/exports/:id/send-to-kindle',
  heavyOperationLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getConnection();

    try {
      const exportRecord = epubGenerator.getExport(parseInt(id));

      // Check if Kindle service is configured
      const kindleService = (await import('../services/kindleService.js')).default;

      if (!kindleService.isConfigured()) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Kindle service not configured. Please set up SMTP settings.'
        });
      }

      // Check if file exists
      try {
        await fs.access(exportRecord.file_path);
      } catch {
        return res.status(404).json({
          error: 'Not Found',
          message: 'EPUB file not found on disk'
        });
      }

      // Send to Kindle
      const result = await kindleService.sendEPUB(exportRecord.file_path, {
        filename: path.basename(exportRecord.file_path)
      });

      // Update export record
      db.prepare(`
        UPDATE epub_exports
        SET sent_to_kindle = 1, sent_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), parseInt(id));

      logger.info('EPUB sent to Kindle', { exportId: id });

      res.json({
        success: true,
        message: 'EPUB sent to Kindle successfully',
        result
      });
    } catch (error) {
      logger.error('Failed to send EPUB to Kindle', {
        exportId: id,
        error: error.message
      });

      res.status(500).json({
        error: 'Failed to send to Kindle',
        message: error.message
      });
    }
  })
);

export default router;
