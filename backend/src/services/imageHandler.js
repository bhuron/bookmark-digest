import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { getConfig } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageHandler {
  constructor() {
    this.timeout = parseInt(getConfig('IMAGE_TIMEOUT_MS', 10000));
    this.maxSize = parseInt(getConfig('MAX_IMAGE_SIZE_MB', 5)) * 1024 * 1024;
    this.imageQuality = parseInt(getConfig('IMAGE_QUALITY', 85));
    this.baseImagesDir = path.join(__dirname, '../../images');

    // Formats this build can decode and re-encode to JPEG, in preference order:
    // the pipeline re-encodes to JPEG whatever arrives, so taking the smallest
    // source a server offers costs nothing extra. AVIF decoding is a build-time
    // option of sharp, so it is only claimed where it is really available.
    this.canDecodeAvif = Boolean(sharp.format.heif?.input?.buffer);

    this.supportedFormats = [
      ...(this.canDecodeAvif ? ['image/avif'] : []),
      'image/webp',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    this.acceptHeader = `${this.supportedFormats.join(',')},image/*;q=0.8`;

    // What to ask for when a server returns something we cannot read: only the
    // formats every sharp build understands
    this.fallbackAcceptHeader = 'image/jpeg,image/png,image/gif';
  }

  /**
   * Download and replace images in HTML content
   */
  async downloadAndReplaceImages(html, baseUrl, articleTitle) {
    const { JSDOM, VirtualConsole } = await import('jsdom');
    
    // Suppress JSDOM console errors
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('error', () => {
      // Silently ignore CSS parsing and other JSDOM errors
    });
    
    const dom = new JSDOM(html, { virtualConsole });
    const doc = dom.window.document;
    const images = doc.querySelectorAll('img');
    const downloadedImages = [];

    // Directory is keyed by title for readability plus a hash of the article URL
    // for uniqueness: two articles can share a title, and a title can change.
    const safeTitle = this._sanitizeFilename(articleTitle) || 'article';
    const articleDir = path.join(this.baseImagesDir, `${safeTitle}-${this._urlHash(baseUrl)}`);

    if (!this._isInsideBaseImagesDir(articleDir)) {
      logger.error('Refusing to write images outside the images directory', {
        path: articleDir
      });
      return { html, images: [] };
    }

    // Drop files left behind by a previous capture of the same URL. The
    // directory itself is created lazily in _downloadImage, so an article with
    // no downloadable images never leaves an empty directory behind.
    try {
      await fs.rm(articleDir, { recursive: true, force: true });
    } catch (error) {
      logger.warn('Failed to clear previous image directory', {
        path: articleDir,
        error: error.message
      });
    }

    // Process each image
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const src = this._getImageSrc(img);

      if (!src || src.startsWith('data:') || src.includes('this.src') || src.includes('javascript:')) {
        continue; // Skip data URIs, JavaScript code, and missing src
      }

      try {
        const localPath = await this._downloadImage(src, baseUrl, articleDir, i);

        // Update image src to relative path
        img.setAttribute('src', localPath);

        // The remote candidates are dead weight now that a local file exists, and
        // a reader or an EPUB must not fetch the original again
        this._dropRemoteCandidates(img);

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
   * Check data attributes first as they contain the real URLs in lazy-loading scenarios
   */
  _getImageSrc(img) {
    const lazySrc = img.dataset?.src ||
           img.getAttribute('data-src') ||
           img.getAttribute('data-lazy-src') ||
           img.getAttribute('data-original');

    if (lazySrc) {
      return lazySrc;
    }

    // A real src (already resolved against the document) beats srcset, which is
    // only a set of alternatives
    const directSrc = img.src || img.getAttribute('src');

    if (directSrc) {
      return directSrc;
    }

    // No src at all: a responsive image keeps its candidates in srcset, which is
    // the only place some articles publish. The browser paints a <picture>
    // source in preference to the img, so follow that order, and take the largest
    // candidate - downloads are capped at 1200px anyway, so the biggest source
    // loses no detail.
    const picture = img.closest?.('picture');

    if (picture) {
      for (const source of picture.querySelectorAll('source[srcset]')) {
        const candidate = this._bestSrcsetCandidate(source.getAttribute('srcset'));
        if (candidate) {
          return candidate;
        }
      }
    }

    return this._bestSrcsetCandidate(img.getAttribute('srcset'));
  }

  /**
   * Largest URL in a srcset attribute, or null when there is none
   *
   * Candidates are separated by commas and described by a width (640w), a pixel
   * density (2x) or nothing at all.
   *
   * @param {string} srcset - Raw srcset attribute value
   * @returns {string|null} - Chosen URL, still relative to the document
   */
  _bestSrcsetCandidate(srcset) {
    if (typeof srcset !== 'string' || !srcset.trim()) {
      return null;
    }

    // A comma inside a data URI is indistinguishable from the separator without
    // a real srcset parser, so leave such an attribute alone rather than pick a
    // fragment of a base64 image as if it were a URL
    if (srcset.includes('data:')) {
      return null;
    }

    const candidates = srcset
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [url, ...descriptors] = part.split(/\s+/);
        const width = descriptors.find(descriptor => descriptor.endsWith('w'));
        const density = descriptors.find(descriptor => descriptor.endsWith('x'));
        const rank = width ? parseInt(width, 10) : (density ? parseFloat(density) * 1000 : 1);

        // Widths and densities never mix within one srcset; the scale factor only
        // keeps the two shapes comparable. An unreadable descriptor ranks last
        return { url, rank: Number.isFinite(rank) ? rank : 0 };
      })
      .filter(candidate => candidate.url);

    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((best, candidate) => (candidate.rank > best.rank ? candidate : best)).url;
  }

  /**
   * Drop the remote candidates once a local file has replaced them, so the stored
   * HTML and the EPUB carry no leftover reference to the original image
   *
   * @param {Element} img - Image element already rewritten to a local path
   */
  _dropRemoteCandidates(img) {
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');

    const picture = img.closest?.('picture');

    if (picture) {
      for (const source of picture.querySelectorAll('source')) {
        source.remove();
      }
    }
  }

  /**
   * Get realistic browser headers for image requests
   */
  _getBrowserHeaders(imageUrl, baseUrl, accept = this.acceptHeader) {
    const urlOrigin = new URL(imageUrl).origin;
    const baseOrigin = new URL(baseUrl).origin;

    return {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': accept,
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': baseUrl,
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': urlOrigin === baseOrigin ? 'same-origin' : 'cross-site'
    };
  }

  /**
   * True when this build can decode the given content type
   */
  _isSupportedFormat(contentType) {
    return Boolean(contentType) &&
      this.supportedFormats.some(format => contentType.includes(format));
  }

  /**
   * Fetch an image, aborting after the configured timeout
   */
  async _fetchImage(imageUrl, baseUrl, accept) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(imageUrl, {
        signal: controller.signal,
        headers: this._getBrowserHeaders(imageUrl, baseUrl, accept)
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Download timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
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
      throw new Error(`Invalid URL: ${src}: ${error.message}`);
    }

    // CDNs pick the format from Accept. If the answer is something this build
    // cannot read, ask once more for the formats every build understands rather
    // than dropping the image.
    let response = await this._fetchImage(imageUrl, baseUrl, this.acceptHeader);
    let contentType = response.headers.get('content-type') || '';

    if (response.ok && !this._isSupportedFormat(contentType)) {
      logger.debug('Retrying image without the formats we cannot read', {
        src,
        contentType
      });

      const retry = await this._fetchImage(imageUrl, baseUrl, this.fallbackAcceptHeader);
      const retryType = retry.headers.get('content-type') || '';

      if (retry.ok && this._isSupportedFormat(retryType)) {
        response = retry;
        contentType = retryType;
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!contentType) {
      throw new Error('No content-type header');
    }

    if (!this._isSupportedFormat(contentType)) {
      throw new Error(`Unsupported format: ${contentType}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > this.maxSize) {
      throw new Error(`Image too large: ${contentLength} bytes`);
    }

    // Download image buffer
    let buffer = await response.arrayBuffer();

    // Kindle and EPUB want JPEG, so anything that is not already a JPEG or a PNG
    // is re-encoded here. That also keeps the bytes on disk in agreement with the
    // .jpg name they are given.
    if (!contentType.includes('jpeg') && !contentType.includes('png')) {
      buffer = await this._convertToJPEG(Buffer.from(buffer));
    }

    // Optimize image
    const optimizedBuffer = await this._optimizeImage(Buffer.from(buffer));

    // Determine file extension
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const filename = `image-${index}-${Date.now()}.${ext}`;
    const localPath = path.join(articleDir, filename);

    // Create the article directory only once an image is actually ready to be
    // written, so captures without images leave nothing behind on disk
    await fs.mkdir(articleDir, { recursive: true });
    await fs.writeFile(localPath, optimizedBuffer);

    // Return absolute path for web display (will be served at /images/)
    return `/images/${path.basename(articleDir)}/${filename}`;
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
          progressive: false
        })
        .toBuffer();
    } catch (error) {
      logger.warn('Failed to optimize image, using original', { error: error.message });
      return buffer;
    }
  }

  /**
   * Stable short hash of the article URL, used to keep image directories unique
   */
  _urlHash(url) {
    return crypto.createHash('sha256').update(String(url || '')).digest('hex').slice(0, 10);
  }

  /**
   * Check that a target path resolves inside the images directory
   */
  _isInsideBaseImagesDir(target) {
    const base = path.resolve(this.baseImagesDir);
    const resolved = path.resolve(target);
    return resolved === base || resolved.startsWith(base + path.sep);
  }

  /**
   * Map a stored `/images/...` path to an absolute path, rejecting anything that
   * would escape the images directory.
   * @param {string} localPath - Stored local path, e.g. `/images/dir/file.jpg`
   * @returns {string|null} - Absolute path, or null when unsafe or malformed
   */
  _resolveLocalImagePath(localPath) {
    if (typeof localPath !== 'string' || !localPath.startsWith('/images/')) {
      return null;
    }

    const relative = localPath.slice('/images/'.length);
    const segments = relative.split('/');

    // Reject empty, current, and parent segments outright
    if (segments.some(segment => segment === '' || segment === '.' || segment === '..')) {
      return null;
    }

    const base = path.resolve(this.baseImagesDir);
    const resolved = path.resolve(this.baseImagesDir, relative);

    // Must be a file inside the images directory, never the directory itself
    return resolved.startsWith(base + path.sep) ? resolved : null;
  }

  /**
   * Delete image files belonging to deleted articles.
   *
   * Best-effort: the database rows are already gone by the time this runs, so
   * failures are logged rather than thrown. Only files recorded for those
   * articles are removed, which keeps a directory shared with another article
   * intact.
   *
   * @param {string[]} localPaths - Stored `/images/...` paths
   * @returns {Promise<number>} - Number of files actually removed
   */
  async deleteImageFiles(localPaths = []) {
    let removed = 0;
    const directories = new Set();

    for (const localPath of localPaths) {
      const absolutePath = this._resolveLocalImagePath(localPath);

      if (!absolutePath) {
        logger.warn('Refusing to delete image outside the images directory', { localPath });
        continue;
      }

      try {
        await fs.unlink(absolutePath);
        removed += 1;
        directories.add(path.dirname(absolutePath));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.warn('Failed to delete image file', { localPath, error: error.message });
        }
      }
    }

    // Prune directories that are now empty. Never recursive: a directory could
    // still hold images belonging to another article.
    for (const directory of directories) {
      try {
        const entries = await fs.readdir(directory);
        if (entries.length === 0) {
          await fs.rmdir(directory);
        }
      } catch {
        // Already gone, or not removable - nothing to do
      }
    }

    return removed;
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
