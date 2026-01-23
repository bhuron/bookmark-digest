import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { getConfig } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageHandler {
  constructor() {
    this.timeout = getConfig('IMAGE_TIMEOUT_MS', 10000);
    this.maxSize = (getConfig('MAX_IMAGE_SIZE_MB', 5)) * 1024 * 1024;
    this.supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    this.imageQuality = getConfig('IMAGE_QUALITY', 85);
    this.baseImagesDir = path.join(__dirname, '../../images');
  }

  /**
   * Download and replace images in HTML content
   */
  async downloadAndReplaceImages(html, baseUrl, articleTitle) {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const images = doc.querySelectorAll('img');
    const downloadedImages = [];

    // Create safe filename for article directory
    const safeTitle = this._sanitizeFilename(articleTitle);
    const articleDir = path.join(this.baseImagesDir, safeTitle);

    try {
      await fs.mkdir(articleDir, { recursive: true });
      logger.debug('Created article image directory', { path: articleDir });
    } catch (error) {
      logger.error('Failed to create image directory', { error: error.message });
      return { html, images: [] };
    }

    // Process each image
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const src = this._getImageSrc(img);

      if (!src || src.startsWith('data:')) {
        continue; // Skip data URIs and missing src
      }

      try {
        const localPath = await this._downloadImage(src, baseUrl, articleDir, i);

        // Update image src to relative path
        img.src = localPath;

        downloadedImages.push({
          originalUrl: src,
          localPath,
          altText: img.alt || '',
          width: img.width || undefined,
          height: img.height || undefined
        });

        logger.debug('Image downloaded successfully', {
          originalUrl: src,
          localPath
        });
      } catch (error) {
        logger.warn('Failed to download image', {
          src,
          error: error.message
        });
        // Keep original src on failure
      }
    }

    return {
      html: doc.documentElement.outerHTML,
      images: downloadedImages
    };
  }

  /**
   * Get image src from element, handling lazy loading
   */
  _getImageSrc(img) {
    return img.src ||
           img.dataset?.src ||
           img.getAttribute('data-src') ||
           img.getAttribute('data-lazy-src') ||
           img.getAttribute('data-original');
  }

  /**
   * Download single image
   */
  async _downloadImage(src, baseUrl, articleDir, index) {
    // Resolve relative URLs
    let imageUrl;
    try {
      imageUrl = new URL(src, baseUrl).href;
    } catch (error) {
      throw new Error(`Invalid URL: ${src}`);
    }

    // Fetch image with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let response;
    try {
      response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BookmarkDigest/1.0; +https://github.com)'
        }
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Download timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType) {
      throw new Error('No content-type header');
    }

    const isSupported = this.supportedFormats.some(f => contentType.includes(f));
    if (!isSupported) {
      throw new Error(`Unsupported format: ${contentType}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > this.maxSize) {
      throw new Error(`Image too large: ${contentLength} bytes`);
    }

    // Download image buffer
    let buffer = await response.arrayBuffer();

    // Convert WebP to JPEG for EPUB compatibility
    if (contentType.includes('webp')) {
      buffer = await this._convertToJPEG(Buffer.from(buffer));
    }

    // Optimize image
    const optimizedBuffer = await this._optimizeImage(Buffer.from(buffer));

    // Determine file extension
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const filename = `image-${index}-${Date.now()}.${ext}`;
    const localPath = path.join(articleDir, filename);

    // Save to disk
    await fs.writeFile(localPath, optimizedBuffer);

    // Return relative path for EPUB usage
    return `images/${path.basename(articleDir)}/${filename}`;
  }

  /**
   * Convert image to JPEG format
   */
  async _convertToJPEG(buffer) {
    try {
      return await sharp(buffer)
        .jpeg({ quality: this.imageQuality })
        .toBuffer();
    } catch (error) {
      logger.warn('Failed to convert to JPEG, using original', { error: error.message });
      return buffer;
    }
  }

  /**
   * Optimize image for EPUB
   */
  async _optimizeImage(buffer) {
    try {
      return await sharp(buffer)
        .resize({
          maxWidth: 1200,
          withoutEnlargement: true
        })
        .jpeg({
          quality: this.imageQuality,
          progressive: true
        })
        .toBuffer();
    } catch (error) {
      logger.warn('Failed to optimize image, using original', { error: error.message });
      return buffer;
    }
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
}

// Create singleton instance
const imageHandler = new ImageHandler();

export default imageHandler;
