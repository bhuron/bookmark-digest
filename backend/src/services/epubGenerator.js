import { Epub as EPub } from '@storyteller-platform/epub';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { getConfig } from '../config.js';
import { getConnection } from '../database/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EPUBGenerator {
  constructor() {
    this.outputDir = getConfig('EPUB_EXPORT_DIR', './epub-exports');
    this.ensureOutputDir();
  }

  /**
   * Ensure output directory exists
   */
  async ensureOutputDir() {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
      logger.info('Created EPUB export directory', { path: this.outputDir });
    }
  }

  /**
   * Generate EPUB from article IDs
   */
  async generateFromArticles(articleIds, options = {}) {
    const db = getConnection();

    // Fetch articles from database
    const placeholders = articleIds.map(() => '?').join(',');
    const articles = db.prepare(`
      SELECT id, title, content_html, author, published_at, url, site_name
      FROM articles
      WHERE id IN (${placeholders})
        AND capture_success = 1
      ORDER BY published_at ASC, created_at ASC
    `).all(...articleIds);

    if (articles.length === 0) {
      throw new Error('No valid articles found for EPUB generation');
    }

    logger.info('Generating EPUB', {
      articleCount: articles.length,
      title: options.title
    });

    try {
      // Create EPUB instance
      const epub = await EPub.create({
        title: options.title || `Bookmark Digest - ${new Date().toLocaleDateString()}`,
        author: options.author || 'Bookmark Digest',
        publisher: 'Bookmark Digest',
        language: 'en',
        identifier: `bookmark-digest-${Date.now()}`
      });

      // Add cover if provided
      if (options.cover && await this._fileExists(options.cover)) {
        try {
          await epub.addCover(options.cover);
          logger.debug('Cover added to EPUB');
        } catch (error) {
          logger.warn('Failed to add cover', { error: error.message });
        }
      }

      // Add each article as a chapter
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        const chapterHtml = this._prepareChapter(article, i + 1);

        await epub.addChapter({
          title: article.title,
          content: chapterHtml,
          fileName: `chapter-${i + 1}.xhtml`
        });

        logger.debug('Chapter added', {
          chapter: i + 1,
          title: article.title
        });
      }

      // Add table of contents
      await epub.addTOC();
      logger.debug('Table of contents added');

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeTitle = this._sanitizeFilename(options.title || 'bookmark-digest');
      const filename = `${safeTitle}-${timestamp}.epub`;
      const filepath = path.join(this.outputDir, filename);

      // Write EPUB to disk
      await epub.write(filepath);
      logger.info('EPUB written to disk', { filepath });

      // Get file stats
      const stats = await fs.stat(filepath);

      // Save export record to database
      const exportStmt = db.prepare(`
        INSERT INTO epub_exports
        (name, article_count, file_path, file_size)
        VALUES (?, ?, ?, ?)
        RETURNING id
      `);

      const exportResult = exportStmt.get(
        options.title || `Bookmark Digest - ${new Date().toLocaleDateString()}`,
        articles.length,
        filepath,
        stats.size
      );

      logger.info('EPUB generation completed', {
        exportId: exportResult.id,
        filename,
        size: stats.size,
        articleCount: articles.length
      });

      return {
        id: exportResult.id,
        filename,
        filepath,
        size: stats.size,
        articleCount: articles.length,
        title: options.title
      };
    } catch (error) {
      logger.error('EPUB generation failed', {
        error: error.message,
        articleCount: articles.length
      });
      throw error;
    }
  }

  /**
   * Prepare chapter HTML with styling
   */
  _prepareChapter(article, chapterNumber) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${this._escapeHtml(article.title)}</title>
    <style type="text/css">
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Georgia, serif;
        line-height: 1.6;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        color: #333;
      }
      h1 {
        border-bottom: 2px solid #eee;
        padding-bottom: 10px;
        margin-bottom: 20px;
        font-size: 1.8em;
      }
      h2, h3, h4, h5, h6 {
        margin-top: 1.5em;
        margin-bottom: 0.8em;
      }
      p {
        margin-bottom: 1em;
      }
      img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 1.5em auto;
      }
      pre {
        background: #f4f4f4;
        padding: 1em;
        overflow-x: auto;
        border-radius: 4px;
      }
      code {
        background: #f4f4f4;
        padding: 0.2em 0.4em;
        border-radius: 3px;
      }
      blockquote {
        border-left: 4px solid #ddd;
        padding-left: 1em;
        margin: 1.5em 0;
        color: #666;
      }
      a {
        color: #0066cc;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      .metadata {
        color: #666;
        font-size: 0.9em;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 1px solid #eee;
      }
      .original-url {
        word-break: break-all;
        font-size: 0.8em;
        color: #888;
      }
    </style>
  </head>
  <body>
    <h1>Chapter ${chapterNumber}: ${this._escapeHtml(article.title)}</h1>
    <div class="metadata">
      ${article.author ? `<p><strong>Author:</strong> ${this._escapeHtml(article.author)}</p>` : ''}
      ${article.site_name ? `<p><strong>Source:</strong> ${this._escapeHtml(article.site_name)}</p>` : ''}
      ${article.published_at ? `<p><strong>Published:</strong> ${new Date(article.published_at).toLocaleDateString()}</p>` : ''}
      <p class="original-url"><strong>Original URL:</strong> ${this._escapeHtml(article.url)}</p>
    </div>
    <div class="content">
      ${article.content_html}
    </div>
  </body>
</html>`;
  }

  /**
   * Escape HTML special characters
   */
  _escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Sanitize filename
   */
  _sanitizeFilename(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  /**
   * Check if file exists
   */
  async _fileExists(filepath) {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get export by ID
   */
  getExport(exportId) {
    const db = getConnection();
    const exportRecord = db.prepare(`
      SELECT * FROM epub_exports WHERE id = ?
    `).get(exportId);

    if (!exportRecord) {
      throw new Error('Export not found');
    }

    return exportRecord;
  }

  /**
   * List all exports
   */
  listExports(limit = 50) {
    const db = getConnection();
    const exports = db.prepare(`
      SELECT * FROM epub_exports
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);

    return exports;
  }
}

// Create singleton instance
const epubGenerator = new EPUBGenerator();

export default epubGenerator;
