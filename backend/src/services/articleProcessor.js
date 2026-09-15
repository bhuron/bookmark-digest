import { Readability } from '@mozilla/readability';
import { JSDOM, VirtualConsole } from 'jsdom';
import createDOMPurify from 'dompurify';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConnection } from '../database/index.js';
import imageHandler from './imageHandler.js';
import logger from '../utils/logger.js';
import { getConfig } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRUE_VALUES = ['true', '1', 'yes', 'on'];

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

    // Where a capture is kept verbatim when DEBUG_SAVE_RAW_HTML is on. Under the
    // gitignored data directory, and never next to the images, which are served
    // over HTTP
    this.rawCaptureDir = path.join(__dirname, '../../data/raw-captures');
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

    // Readability strips the document it parses as it harvests, so the raw
    // capture is counted before it runs
    const rawCensus = this._graphicsCensus(dom.window.document);

    // Extract with Readability
    const reader = new Readability(dom.window.document, this.readabilityOptions);
    const article = reader.parse();

    if (!article) {
      logger.warn('Readability failed to extract article', { url });

      await this._saveRawCapture(html, url, dom.window.document.title);

      // Return failure with original HTML for manual review
      return {
        success: false,
        error: 'Readability extraction failed - content could not be extracted',
        originalHtml: html,
        url,
        title: dom.window.document.title || 'Untitled'
      };
    }

    await this._saveRawCapture(html, url, article.title);

    // Validate article length
    if (article.content.length > this.MAX_ARTICLE_LENGTH) {
      logger.warn('Article too long, truncating', {
        url,
        originalLength: article.content.length,
        maxLength: this.MAX_ARTICLE_LENGTH
      });
      article.content = article.content.substring(0, this.MAX_ARTICLE_LENGTH);
    }

    // Sanitize HTML to remove malicious content.
    //
    // srcset and sizes must be allowed explicitly: passing ALLOWED_ATTR replaces
    // DOMPurify's defaults, and without them a responsive image loses the only
    // URL it carries, silently and before the downloader ever sees it.
    const DOMPurify = createDOMPurify(dom.window);
    const sanitizedContent = DOMPurify.sanitize(article.content, {
      ALLOWED_ATTR: ['href', 'src', 'srcset', 'sizes', 'alt', 'title', 'width', 'height', 'class', 'style', 'loading', 'target', 'rel', 'data-*'],
      ADD_TAGS: ['figure', 'figcaption'],
      ADD_ATTR: ['loading', 'target', 'rel', 'data-*']
    });

    // A graphic that is not in the stored HTML cannot be recovered afterwards,
    // and any of the three stages can be the one that lost it, so count what each
    // stage holds: missing from the raw capture is an extension problem, missing
    // after Readability is an extraction problem, missing after sanitising is ours
    this._logGraphicsCensus(url, dom.window.document, rawCensus, article.content, sanitizedContent);

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
   * Keep the untouched capture when DEBUG_SAVE_RAW_HTML is on
   *
   * The census says how many graphics a stage lost, never which ones. A chart
   * that Readability or the sanitiser discarded is only identifiable in the
   * original capture, so this writes it out verbatim to be inspected afterwards.
   *
   * Best-effort by design: a diagnostic must never fail the capture it describes.
   *
   * @param {string} html - Raw capture as received
   * @param {string} url - Article URL
   * @param {string} title - Extracted title, used for the file name
   */
  async _saveRawCapture(html, url, title) {
    if (!TRUE_VALUES.includes(String(getConfig('DEBUG_SAVE_RAW_HTML', 'false')).toLowerCase())) {
      return;
    }

    const slug = String(title || 'capture')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50) || 'capture';

    const hash = crypto.createHash('sha256').update(String(url || '')).digest('hex').slice(0, 10);
    const file = path.join(this.rawCaptureDir, `${slug}-${hash}.html`);

    try {
      await fs.mkdir(this.rawCaptureDir, { recursive: true });
      await fs.writeFile(file, html);
      logger.info('Raw capture saved', { url, file, bytes: html.length });
    } catch (error) {
      logger.warn('Failed to save raw capture', { url, error: error.message });
    }
  }

  /**
   * Count the elements that carry a graphic, in any node or document
   *
   * @param {Document|Element} root - Node to search
   * @returns {object} - Element counts per kind
   */
  _graphicsCensus(root) {
    if (!root || typeof root.querySelectorAll !== 'function') {
      return { img: 0, picture: 0, srcset: 0, svg: 0, canvas: 0, iframe: 0, figure: 0, custom: 0 };
    }

    return {
      img: root.querySelectorAll('img').length,
      picture: root.querySelectorAll('picture').length,
      srcset: root.querySelectorAll('img[srcset], source[srcset]').length,
      svg: root.querySelectorAll('svg').length,
      canvas: root.querySelectorAll('canvas').length,
      iframe: root.querySelectorAll('iframe').length,
      figure: root.querySelectorAll('figure').length,
      // A hyphen in a tag name means a custom element, which is a likely host for
      // a JavaScript-drawn chart: its content lives in a shadow root, and
      // outerHTML has no shadow root to serialise
      custom: Array.from(root.querySelectorAll('*'))
        .filter(element => element.tagName.includes('-')).length
    };
  }

  /**
   * Log the graphics census of each pipeline stage so a missing chart can be
   * traced to the stage that lost it. Quiet for ordinary photo articles; loud as
   * soon as the capture holds a graphic the image pipeline cannot download.
   *
   * @param {string} url - Article URL
   * @param {Document} doc - Document the raw capture was parsed into
   * @param {object} rawCensus - Census of the raw capture, taken before Readability ran
   * @param {string} extractedHtml - Readability output
   * @param {string} sanitizedHtml - Sanitised content
   */
  _logGraphicsCensus(url, doc, rawCensus, extractedHtml, sanitizedHtml) {
    // Counted in a detached element, so the document being inspected is untouched
    const probe = doc.createElement('div');
    const censusOf = (html) => {
      probe.innerHTML = html || '';
      const census = this._graphicsCensus(probe);
      probe.innerHTML = '';
      return census;
    };

    const raw = rawCensus || this._graphicsCensus(doc);
    const extracted = censusOf(extractedHtml);
    const sanitized = censusOf(sanitizedHtml);

    const interesting = raw.svg > 0 || raw.canvas > 0 || raw.iframe > 0 ||
      raw.picture > 0 || raw.srcset > 0 || raw.custom > 0;

    logger[interesting ? 'info' : 'debug']('Graphics census', {
      url,
      raw,
      extracted,
      sanitized
    });
  }

  /**
   * Save processed article to database
   */
  async saveArticle(articleData) {
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
            -- Re-capturing a URL that is in the trash brings it back
            deleted_at = NULL,
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
