import { EPub } from '@lesjoursfr/html-to-epub';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';

import logger from '../utils/logger.js';
import { getConfig } from '../config.js';
import { getConnection } from '../database/index.js';
import coverGenerator from './coverGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));



class EPUBGenerator {
  constructor() {
    this.outputDir = getConfig('EPUB_EXPORT_DIR', './epub-exports');
    this.imagesDir = path.join(__dirname, '../../images');
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
       // Generate filename
       const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
       const safeTitle = this._sanitizeFilename(options.title || 'bookmark-digest');
       const filename = `${safeTitle}-${timestamp}.epub`;
       const filepath = path.join(this.outputDir, filename);

       // Generate cover image automatically
       let coverPath = null;
       try {
         coverPath = await coverGenerator.generateCover(
           options.title || `Bookmark Digest - ${new Date().toLocaleDateString()}`,
           articles.length,
           options.author || 'Bookmark Digest',
           options.cover // Use custom cover if provided, otherwise use default news-1.png
         );
         logger.info('Cover image generated successfully', { coverPath });
       } catch (coverError) {
         logger.warn('Failed to generate cover image, continuing without cover', {
           error: coverError.message
         });
       }

       // Prepare CSS (extract from chapter template)
       const css = this._prepareCss();
       
       // Prepare content array for EPUB
       const content = [];
       for (let i = 0; i < articles.length; i++) {
         const article = articles[i];
         const chapterHtml = this._prepareArticleContent(article, i + 1);

         content.push({
           title: article.title,
           data: chapterHtml,
           // Don't set author here - library auto-renders it with no option to disable
           // Author info is already in the HTML metadata from _prepareArticleContent
           filename: `chapter-${i + 1}`
         });

         logger.debug('Chapter prepared', {
           chapter: i + 1,
           title: article.title
         });
       }
       
       // EPUB options
       const epubOptions = {
         title: options.title || `Bookmark Digest - ${new Date().toLocaleDateString()}`,
         description: `Collection of ${articles.length} articles from Bookmark Digest`,
         author: options.author || 'Bookmark Digest',
         lang: 'en-US',
         date: new Date().toISOString(),
         version: 3,
         css,
         content,
         // Disable audio/video downloads
         downloadAudioVideoFiles: false,
         // Don't auto-append chapter titles (we have custom formatting in content HTML)
         appendChapterTitles: false,
         // Use generated cover or custom cover
         cover: coverPath || (options.cover && await this._fileExists(options.cover) ? options.cover : null)
       };
       
       // Create and render EPUB
       const epub = new EPub(epubOptions, filepath);
       await epub.render();
       
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




   /**
   * Prepare CSS for EPUB
   */
  _prepareCss() {
    return `body {
  font-family: Georgia, 'Times New Roman', Times, serif;
  line-height: 1.65;
  max-width: 700px;
  margin: 0 auto;
  padding: 20px;
  color: #333;
  text-align: justify;
  hyphens: auto;
}
h1 {
  font-size: 2em;
  margin-top: 1.5em;
  margin-bottom: 1em;
  font-weight: bold;
  line-height: 1.3;
  page-break-after: avoid;
}
h2, h3, h4, h5, h6 {
  margin-top: 1.5em;
  margin-bottom: 0.8em;
  page-break-after: avoid;
}
h2 {
  font-size: 1.6em;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5em;
}
h3 {
  font-size: 1.3em;
}
p {
  margin-bottom: 1em;
}
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1.5em auto;
  border: 1px solid #eee;
  border-radius: 4px;
  page-break-inside: avoid;
}
figure {
  margin: 2em 0;
  text-align: center;
  page-break-inside: avoid;
}
figcaption {
  font-size: 0.9em;
  color: #666;
  margin-top: 0.5em;
  font-style: italic;
  line-height: 1.4;
}
pre {
  background: #f8f9fa;
  padding: 1em;
  overflow-x: auto;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  font-family: 'Courier New', Courier, monospace;
  line-height: 1.5;
  page-break-inside: avoid;
}
code {
  background: #f8f9fa;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  border: 1px solid #e9ecef;
}
blockquote {
  border-left: 4px solid #6c757d;
  padding-left: 1.5em;
  margin: 2em 0;
  color: #495057;
  font-style: italic;
  background: #f8f9fa;
  padding-top: 1em;
  padding-bottom: 1em;
  padding-right: 1em;
  border-radius: 0 6px 6px 0;
  page-break-inside: avoid;
}
ul, ol {
  margin: 1em 0;
  padding-left: 2em;
}
li {
  margin-bottom: 0.5em;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1.5em 0;
}
th, td {
  border: 1px solid #dee2e6;
  padding: 0.75em;
  text-align: left;
}
th {
  background-color: #f8f9fa;
  font-weight: bold;
}
hr {
  border: none;
  border-top: 1px solid #eee;
  margin: 2em 0;
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
  page-break-after: avoid;
}
.original-url {
  word-break: break-all;
  font-size: 0.8em;
  color: #888;
}`;
  }

   /**
   * Prepare article content HTML fragment (without XHTML wrapper)
   */
  _prepareArticleContent(article, chapterNumber) {
    return `
    <h1>Chapter ${chapterNumber}: ${this._escapeHtml(article.title)}</h1>
    <div class="metadata">
      ${article.author ? `<p><strong>Author:</strong> ${this._escapeHtml(article.author)}</p>` : ''}
      ${article.site_name ? `<p><strong>Source:</strong> ${this._escapeHtml(article.site_name)}</p>` : ''}
      ${article.published_at ? `<p><strong>Published:</strong> ${new Date(article.published_at).toLocaleDateString()}</p>` : ''}
      <p class="original-url"><strong>Original URL:</strong> ${this._escapeHtml(article.url)}</p>
    </div>
    <div class="content">
      ${this._htmlToXhtml(article.content_html)}
    </div>`;
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
   * Convert HTML to well-formed XHTML for EPUB
   */
  _htmlToXhtml(html) {
    if (!html) return '';
    
    let xhtml = html;
    
    // Replace HTML entities that are not valid in XML
    xhtml = xhtml.replace(/&nbsp;/g, '&#160;');
    xhtml = xhtml.replace(/&ndash;/g, '&#8211;');
    xhtml = xhtml.replace(/&mdash;/g, '&#8212;');
    xhtml = xhtml.replace(/&lsquo;/g, '&#8216;');
    xhtml = xhtml.replace(/&rsquo;/g, '&#8217;');
    xhtml = xhtml.replace(/&ldquo;/g, '&#8220;');
    xhtml = xhtml.replace(/&rdquo;/g, '&#8221;');
    xhtml = xhtml.replace(/&hellip;/g, '&#8230;');
    
    // Process images: extract from picture tags, convert paths to absolute URLs
    xhtml = this._processImagesInHtml(xhtml);
    
    // Close self-closing tags (void elements in HTML)
    const voidElements = ['br', 'hr', 'meta', 'link', 'input', 'area', 'base', 'col', 'command', 'embed', 'keygen', 'param', 'track', 'wbr'];
    voidElements.forEach(tag => {
      const regex = new RegExp(`<${tag}([^>]*)(?<!/)>`, 'gi');
      xhtml = xhtml.replace(regex, `<${tag}$1/>`);
    });
    
    return xhtml;
  }

  /**
   * Process images in HTML for EPUB generation
   */
  _processImagesInHtml(html) {
    let processed = html;
    
    // Extract img from picture tags and remove picture/source wrappers
    // <picture><source...><img...></picture> -> <img...>
    processed = processed.replace(/<picture[^>]*>([\s\S]*?)<\/picture>/gi, (match, inner) => {
      // Extract img tag from inner HTML
      const imgMatch = inner.match(/<img[^>]*>/i);
      return imgMatch ? imgMatch[0] : '';
    });
    
    // Remove source tags (not needed for EPUB)
    processed = processed.replace(/<source[^>]*>/gi, '');
    
    // Convert image src paths to file:// URLs for EPUB library to download
    processed = processed.replace(/<img([^>]*)>/gi, (match, attributes) => {
      // Parse src attribute
      const srcMatch = attributes.match(/src\s*=\s*['"]([^'"]*)['"]/i);
      if (srcMatch) {
        let src = srcMatch[1];
        // Convert /images/ paths to file:// URLs
        if (src.startsWith('/images/')) {
          // Remove leading /images/ to get relative path
          const relativePath = src.substring('/images/'.length);
          const absolutePath = path.join(this.imagesDir, relativePath);
          // Check if file exists
          try {
            fsSync.accessSync(absolutePath, fsSync.constants.R_OK);
            // Use absolute file path (library may handle local files)
            src = absolutePath;
            logger.info('Converting image path to absolute file path', { 
              originalSrc: srcMatch[1], 
              filePath: src,
              absolutePath 
            });
            // Update the src attribute
            return `<img${attributes.replace(srcMatch[0], `src="${src}"`)}>`;
          } catch (error) {
            logger.warn('Image file not found, removing img tag', { 
              path: absolutePath,
              originalSrc: src,
              error: error.message 
            });
            return ''; // Remove image if file doesn't exist
          }
        }
        // Keep other src as-is (data URIs, http/https URLs, file:// URLs)
      }
      return match;
    });
    
    return processed;
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
