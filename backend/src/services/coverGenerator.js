import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

import { getConfig } from '../config.js';
import logger from '../utils/logger.js';



/**
 * Cover Image Generator
 * Creates professional EPUB cover images with background image and text overlay
 */
class CoverGenerator {
  constructor() {
    // The news-1.png is in the repository root, not the backend directory
    this.defaultCoverPath = path.join(process.cwd(), '..', 'news-1.png');
    this.outputDir = getConfig('EPUB_EXPORT_DIR', './epub-exports');
  }

  /**
   * Generate a cover image for EPUB
   * @param {string} title - EPUB title
   * @param {number} articleCount - Number of articles
   * @param {string} author - Author name
   * @param {string} customImagePath - Path to custom background image
   * @returns {Promise<string>} Path to generated cover image
   */
  async generateCover(title, articleCount, author = 'Bookmark Digest', customImagePath = null) {
    const timestamp = Date.now();
    const coverPath = path.join(this.outputDir, `cover-${timestamp}.png`);

    try {
      // Use custom image or default news-1.png
      const backgroundPath = customImagePath || this.defaultCoverPath;

      // Check if background image exists
      try {
        await fs.access(backgroundPath);
      } catch {
        logger.warn('Background image not found, using default gradient', { path: backgroundPath });
      }

      // Get dimensions of background image
      let bgWidth, bgHeight;
      try {
        const metadata = await sharp(backgroundPath).metadata();
        bgWidth = metadata.width || 1200;
        bgHeight = metadata.height || 1600;
      } catch {
        // Default to EPUB cover dimensions
        bgWidth = 1200;
        bgHeight = 1600;
      }

      // Create SVG overlay with text
      const svg = this._createSvgOverlay(title, articleCount, author, bgWidth, bgHeight);

      // Composite: background image + SVG text overlay
      const coverImage = sharp(backgroundPath)
        .resize(bgWidth, bgHeight, { fit: 'cover', position: 'center' })
        .composite([
          {
            input: Buffer.from(svg),
            top: 0,
            left: 0,
  }


        ]);

      await coverImage.toFile(coverPath);

      logger.info('Cover image generated', { path: coverPath, title, articleCount });
      return coverPath;
    } catch (error) {
      logger.error('Failed to generate cover image', { error: error.message });
      throw error;
    }
  }

  /**
   * Create SVG overlay with text
   * @private
   */
  _createSvgOverlay(title, articleCount, author, width, height) {
    // Truncate title if too long
    const displayTitle = this._truncateText(title, 50);
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // SVG dimensions and padding
    const padding = 80;
    const contentWidth = width - (padding * 2);

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(15, 23, 42, 0.75);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(15, 23, 42, 0.85);stop-opacity:1" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0, 0, 0, 0.5)"/>
          </filter>
        </defs>

        <!-- Dark overlay for text readability -->
        <rect width="100%" height="100%" fill="url(#overlay)"/>

        <!-- Content container -->
        <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Georgia, serif">
          <!-- Top section: Date and article count badge -->
          <text x="${padding}" y="${padding + 40}"
                font-size="20"
                fill="#94a3b8"
                font-weight="400"
                letter-spacing="1">
            ${this._escapeXml(date)}
          </text>

          <!-- Article count badge -->
          <g transform="translate(${width - padding - 150}, ${padding + 10})">
            <rect width="150" height="50" rx="25" fill="rgba(20, 184, 166, 0.9)" filter="url(#shadow)"/>
            <text x="75" y="32"
                  font-size="18"
                  fill="#ffffff"
                  font-weight="600"
                  text-anchor="middle"
                  letter-spacing="0.5">
              ${articleCount} ${articleCount === 1 ? 'ARTICLE' : 'ARTICLES'}
            </text>
          </g>

          <!-- Center section: Title -->
          <g transform="translate(${padding}, ${height * 0.45})">
            <!-- Decorative line above title -->
            <line x1="0" y1="-30" x2="80" y2="-30"
                  stroke="#14b8a6"
                  stroke-width="3"
                  stroke-linecap="round"/>

            <!-- Main title -->
            <text x="0" y="0"
                  font-size="56"
                  fill="#f1f5f9"
                  font-weight="700"
                  letter-spacing="-0.5">
              ${this._generateTitleSvg(displayTitle)}
            </text>

            <!-- Decorative line below title -->
            <line x1="0" y1="100" x2="${contentWidth}" y2="100"
                  stroke="#334155"
                  stroke-width="1"
                  stroke-dasharray="4 4"/>
          </g>

          <!-- Bottom section: Author and branding -->
          <g transform="translate(${padding}, ${height - padding - 20})">
            <text x="0" y="0"
                  font-size="22"
                  fill="#cbd5e1"
                  font-weight="400">
              ${this._escapeXml(author)}
            </text>

            <text x="0" y="35"
                  font-size="16"
                  fill="#64748b"
                  font-weight="400"
                  letter-spacing="2">
              BOOKMARK DIGEST
            </text>

            <!-- Small accent line -->
            <line x1="0" y1="55" x2="60" y2="55"
                  stroke="#14b8a6"
                  stroke-width="2"
                  stroke-linecap="round"/>
          </g>
        </g>
      </svg>
    `.trim();
  }

  /**
   * Truncate text to max length
   * @private
   */
  _truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Escape special XML characters
   * @private
   */
  _escapeXml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Word wrap text for display
   * @private
   */
  _wordWrap(text, maxLength) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = [];

    for (const word of words) {
      const testLine = [...currentLine, word].join(' ');
      if (testLine.length <= maxLength || currentLine.length === 0) {
        currentLine.push(word);
      } else {
        lines.push(currentLine.join(' '));
        currentLine = [word];
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }

    // Limit to 3 lines max
    return lines.slice(0, 3);
  }
  _generateTitleSvg(title) {
    const lines = this._wordWrap(title, 25);
    if (lines.length === 0) return '';
    
    const escapedLines = lines.map(line => this._escapeXml(line));
    
    if (escapedLines.length === 1) {
      return `<tspan x="0">${escapedLines[0]}</tspan>`;
    }
    
    // First line without dy, subsequent lines with dy="70"
    const tspans = [];
    tspans.push(`<tspan x="0">${escapedLines[0]}</tspan>`);
    for (let i = 1; i < escapedLines.length; i++) {
      tspans.push(`<tspan x="0" dy="70">${escapedLines[i]}</tspan>`);
    }
    return tspans.join('');
  }
}

// Create singleton instance
const coverGenerator = new CoverGenerator();

export default coverGenerator;
