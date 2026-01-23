import { Readability } from '@mozilla/readability';
import { JSDOM, VirtualConsole } from 'jsdom';
import createDOMPurify from 'dompurify';
import { getConnection } from '../database/index.js';
import imageHandler from './imageHandler.js';
import logger from '../utils/logger.js';

class ArticleProcessor {
  constructor() {
    this.readabilityOptions = {
      debug: false,
      maxElemsToParse: 0,
      nbTopCandidates: 5,
      charThreshold: 500
    };

    // Size limits
    this.MAX_HTML_SIZE = 10 * 1024 * 1024; // 10MB
    this.MAX_ARTICLE_LENGTH = 500000; // 500K chars
  }

  /**
   * Process article HTML with Readability
   */
  async processArticle(html, url, options = {}) {
    // Validate input size
    if (html.length > this.MAX_HTML_SIZE) {
      throw new Error(`HTML too large: ${html.length} bytes (max ${this.MAX_HTML_SIZE})`);
    }

    let dom;
    try {
      // Suppress JSDOM console errors (CSS parsing errors, etc.)
      const virtualConsole = new VirtualConsole();
      virtualConsole.on('error', () => {
        // Silently ignore CSS parsing and other JSDOM errors
      });
      
      dom = new JSDOM(html, {
        url,
        virtualConsole
      });
    } catch (error) {
      logger.error('JSDOM parsing failed', { url, error: error.message });
      throw new Error(`Failed to parse HTML: ${error.message}`);
    }

    // Extract with Readability
    const reader = new Readability(dom.window.document, this.readabilityOptions);
    const article = reader.parse();

    if (!article) {
      logger.warn('Readability failed to extract article', { url });

      // Return failure with original HTML for manual review
      return {
        success: false,
        error: 'Readability extraction failed - content could not be extracted',
        originalHtml: html,
        url,
        title: dom.window.document.title || 'Untitled'
      };
    }

    // Validate article length
    if (article.content.length > this.MAX_ARTICLE_LENGTH) {
      logger.warn('Article too long, truncating', {
        url,
        originalLength: article.content.length,
        maxLength: this.MAX_ARTICLE_LENGTH
      });
      article.content = article.content.substring(0, this.MAX_ARTICLE_LENGTH);
    }

    // Sanitize HTML to remove malicious content
    const DOMPurify = createDOMPurify(dom.window);
    const sanitizedContent = DOMPurify.sanitize(article.content, {
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'width', 'height', 'class', 'style', 'loading', 'target', 'rel', 'data-*'],
      ADD_TAGS: ['figure', 'figcaption'],
      ADD_ATTR: ['loading', 'target', 'rel', 'data-*']
    });

    // Download and process images if enabled
    let processedHtml = sanitizedContent;
    let imageData = [];

    if (options.preserveImages) {
      try {
        const result = await imageHandler.downloadAndReplaceImages(
          sanitizedContent,
          url,
          article.title
        );
        processedHtml = result.html;
        imageData = result.images;

        logger.info('Images processed', {
          url,
          imageCount: imageData.length
        });
      } catch (error) {
        logger.error('Image processing failed', {
          url,
          error: error.message
        });
        // Continue without images rather than failing completely
      }
    }

    // Calculate reading time (average 200 WPM)
    const wordCount = (article.textContent || '').split(/\s+/).filter(w => w.length > 0).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    return {
      success: true,
      url,
      originalUrl: url,
      title: article.title || 'Untitled',
      contentHtml: processedHtml,
      contentText: article.textContent || '',
      excerpt: article.excerpt || '',
      author: article.byline || null,
      siteName: article.siteName || null,
      publishedAt: article.publishedTime ? new Date(article.publishedTime) : null,
      wordCount,
      readingTimeMinutes: readingTime,
      language: article.lang || 'en',
      hasImages: imageData.length > 0,
      imageCount: imageData.length,
      images: imageData
    };
  }

  /**
   * Save processed article to database
   */
  async saveArticle(articleData, tags = []) {
    const db = getConnection();

    try {
      return db.transaction(() => {
        // Insert or update article
        const articleStmt = db.prepare(`
          INSERT INTO articles
          (url, original_url, title, content_html, content_text, excerpt,
           author, site_name, published_at, word_count, reading_time_minutes,
           language, has_images, image_count, capture_success)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          ON CONFLICT(url) DO UPDATE SET
            title = excluded.title,
            content_html = excluded.content_html,
            content_text = excluded.content_text,
            excerpt = excluded.excerpt,
            author = excluded.author,
            site_name = excluded.site_name,
            published_at = excluded.published_at,
            word_count = excluded.word_count,
            reading_time_minutes = excluded.reading_time_minutes,
            language = excluded.language,
            has_images = excluded.has_images,
            image_count = excluded.image_count,
            capture_success = 1,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `);

        const result = articleStmt.get(
          articleData.url,
          articleData.originalUrl,
          articleData.title,
          articleData.contentHtml,
          articleData.contentText,
          articleData.excerpt,
          articleData.author || null,
          articleData.siteName || null,
          articleData.publishedAt ? articleData.publishedAt.toISOString() : null,
          articleData.wordCount,
          articleData.readingTimeMinutes,
          articleData.language,
          articleData.hasImages ? 1 : 0,
          articleData.imageCount
        );

        const articleId = result.id;

        // Save images
        if (articleData.images && articleData.images.length > 0) {
          this._saveImages(db, articleId, articleData.images);
        }

        // Process tags
        if (tags && tags.length > 0) {
          this._saveTagsForArticle(db, articleId, tags);
        }

        logger.info('Article saved successfully', {
          articleId,
          title: articleData.title,
          url: articleData.url
        });

        return articleId;
      })();
    } catch (error) {
      logger.error('Failed to save article', {
        error: error.message,
        url: articleData.url
      });
      throw error;
    }
  }

  /**
   * Save article images to database
   */
  _saveImages(db, articleId, images) {
    const imageStmt = db.prepare(`
      INSERT INTO article_images
      (article_id, original_url, local_path, alt_text, width, height, size_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const image of images) {
      try {
        imageStmt.run(
          articleId,
          image.originalUrl,
          image.localPath,
          image.altText || null,
          image.width || null,
          image.height || null,
          image.sizeBytes || null
        );
      } catch (error) {
        logger.error('Failed to save image', {
          articleId,
          imageUrl: image.originalUrl,
          error: error.message
        });
      }
    }
  }

  /**
   * Save tags for an article
   */
  _saveTagsForArticle(db, articleId, tagNames) {
    const tagInsertStmt = db.prepare(`
      INSERT OR IGNORE INTO tags (name) VALUES (?)
    `);

    const tagGetStmt = db.prepare(`
      SELECT id FROM tags WHERE name = ?
    `);

    const articleTagStmt = db.prepare(`
      INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)
    `);

    for (const tagName of tagNames) {
      try {
        const cleanTag = tagName.trim().toLowerCase();
        if (!cleanTag) continue;

        tagInsertStmt.run(cleanTag);
        const tagResult = tagGetStmt.get(cleanTag);

        if (tagResult) {
          articleTagStmt.run(articleId, tagResult.id);
        }
      } catch (error) {
        logger.error('Failed to save tag', {
          articleId,
          tagName,
          error: error.message
        });
      }
    }
  }

  /**
   * Mark article as failed
   */
  async saveFailedArticle(url, error, html = null) {
    const db = getConnection();

    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO articles
        (url, title, capture_success, capture_error, content_html, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      stmt.run(
        url,
        'Failed Capture',
        error,
        html ? html.substring(0, 10000) : null
      );

      logger.warn('Failed article saved', { url, error });
    } catch (dbError) {
      logger.error('Failed to save error record', {
        url,
        error: dbError.message
      });
    }
  }
}

// Create singleton instance
const articleProcessor = new ArticleProcessor();

export default articleProcessor;
