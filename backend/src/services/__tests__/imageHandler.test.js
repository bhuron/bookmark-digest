import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import imageHandler from '../imageHandler.js';
import fs from 'fs/promises';

describe('ImageHandler', () => {
  describe('downloadAndReplaceImages', () => {
    it('should have downloadAndReplaceImages method', () => {
      expect(imageHandler.downloadAndReplaceImages).toBeDefined();
      expect(typeof imageHandler.downloadAndReplaceImages).toBe('function');
    });

    it('should return object with html and images properties', async () => {
      const html = '<div><p>No images here</p></div>';
      const baseUrl = 'https://example.com/article';
      const articleTitle = 'Test Article';

      const result = await imageHandler.downloadAndReplaceImages(html, baseUrl, articleTitle);

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('images');
      expect(Array.isArray(result.images)).toBe(true);
    });

    it('should handle HTML without images', async () => {
      const html = '<div><p>No images here</p></div>';
      const baseUrl = 'https://example.com/article';
      const articleTitle = 'Test Article';

      const result = await imageHandler.downloadAndReplaceImages(html, baseUrl, articleTitle);

      expect(result.images).toHaveLength(0);
      expect(result.html).toContain('No images here');
    });

    it('should handle data URIs gracefully', async () => {
      const html = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==">';
      const baseUrl = 'https://example.com/article';
      const articleTitle = 'Test Article';

      const result = await imageHandler.downloadAndReplaceImages(html, baseUrl, articleTitle);

      // Data URIs should be skipped
      expect(result.images).toHaveLength(0);
    });

    it('should preserve alt text from images', async () => {
      const html = '<img src="/test.jpg" alt="Test alt text">';
      const baseUrl = 'https://example.com/article';
      const articleTitle = 'Test Article';

      const result = await imageHandler.downloadAndReplaceImages(html, baseUrl, articleTitle);

      // The alt text should be preserved in the HTML
      expect(result.html).toContain('alt="Test alt text"');
    });

    it('should handle invalid URLs gracefully', async () => {
      const html = '<img src="not-a-valid-url">';
      const baseUrl = 'https://example.com/article';
      const articleTitle = 'Test Article';

      // Should not throw, but return the HTML with unchanged src
      const result = await imageHandler.downloadAndReplaceImages(html, baseUrl, articleTitle);

      expect(result).toHaveProperty('html');
    });
  });

  describe('_getImageSrc', () => {
    it('should get src from standard img src attribute', () => {
      const mockImg = {
        src: 'https://example.com/image.jpg',
        dataset: null,
        getAttribute: function(attr) { return null; }
      };

      const src = imageHandler._getImageSrc(mockImg);
      expect(src).toBe('https://example.com/image.jpg');
    });

    it('should get src from data-src attribute (lazy loading)', () => {
      const mockImg = {
        src: null,
        dataset: { src: 'https://example.com/lazy-image.jpg' },
        getAttribute: function(attr) { return this.dataset?.[attr.replace('data-', '')]; }
      };

      const src = imageHandler._getImageSrc(mockImg);
      expect(src).toBe('https://example.com/lazy-image.jpg');
    });

    it('should get src from data-lazy-src attribute', () => {
      const mockImg = {
        src: null,
        dataset: null,
        getAttribute: function(attr) { return attr === 'data-lazy-src' ? 'https://example.com/lazy.jpg' : null; }
      };

      const src = imageHandler._getImageSrc(mockImg);
      expect(src).toBe('https://example.com/lazy.jpg');
    });

    it('should get src from data-original attribute', () => {
      const mockImg = {
        src: null,
        dataset: null,
        getAttribute: function(attr) { return attr === 'data-original' ? 'https://example.com/original.jpg' : null; }
      };

      const src = imageHandler._getImageSrc(mockImg);
      expect(src).toBe('https://example.com/original.jpg');
    });

    it('should return null if no src found', () => {
      const mockImg = {
        src: null,
        dataset: null,
        getAttribute: function(attr) { return null; }
      };

      const src = imageHandler._getImageSrc(mockImg);
      expect(src).toBeNull();
    });
  });

  describe('_sanitizeFilename', () => {
    it('should sanitize filenames by removing special characters', () => {
      const filename = imageHandler._sanitizeFilename('Test Title! With Special @#$ Characters');
      expect(filename).toMatch(/^[a-z0-9-]+$/);
      expect(filename).not.toContain('!');
      expect(filename).not.toContain('@');
      expect(filename).not.toContain('#');
      expect(filename).not.toContain('$');
    });

    it('should convert to lowercase', () => {
      const filename = imageHandler._sanitizeFilename('UPPERCASE Title');
      expect(filename).toBe(filename.toLowerCase());
    });

    it('should replace spaces with hyphens', () => {
      const filename = imageHandler._sanitizeFilename('test title here');
      expect(filename).toContain('-');
      expect(filename).not.toContain(' ');
    });

    it('should truncate long filenames', () => {
      const longTitle = 'a'.repeat(100);
      const filename = imageHandler._sanitizeFilename(longTitle);
      expect(filename.length).toBeLessThanOrEqual(50);
    });

    it('should remove leading and trailing hyphens', () => {
      const filename = imageHandler._sanitizeFilename('---test---');
      expect(filename).not.toMatch(/^-|-$/);
    });

    it('should handle unicode characters', () => {
      const filename = imageHandler._sanitizeFilename('Title with émojis 🎉 and üñîçödé');
      expect(filename).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe('_convertToJPEG', () => {
    it('should have _convertToJPEG method', () => {
      expect(imageHandler._convertToJPEG).toBeDefined();
      expect(typeof imageHandler._convertToJPEG).toBe('function');
    });

    it('should return buffer', async () => {
      // Create a minimal PNG buffer (1x1 pixel)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE
      ]);

      const result = await imageHandler._convertToJPEG(pngBuffer);
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle invalid buffer gracefully', async () => {
      const invalidBuffer = Buffer.from('not-an-image');

      // Should not throw, but return original buffer
      const result = await imageHandler._convertToJPEG(invalidBuffer);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('_optimizeImage', () => {
    it('should have _optimizeImage method', () => {
      expect(imageHandler._optimizeImage).toBeDefined();
      expect(typeof imageHandler._optimizeImage).toBe('function');
    });

    it('should return buffer', async () => {
      // Create a minimal JPEG buffer (1x1 pixel)
      const jpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00
      ]);

      const result = await imageHandler._optimizeImage(jpegBuffer);
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle invalid buffer gracefully', async () => {
      const invalidBuffer = Buffer.from('not-an-image');

      // Should not throw, but return original buffer
      const result = await imageHandler._optimizeImage(invalidBuffer);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('ImageHandler Configuration', () => {
    it('should have configured timeout', () => {
      expect(imageHandler.timeout).toBeDefined();
      expect(typeof imageHandler.timeout).toBe('number');
      expect(imageHandler.timeout).toBeGreaterThan(0);
    });

    it('should have configured max size', () => {
      expect(imageHandler.maxSize).toBeDefined();
      expect(typeof imageHandler.maxSize).toBe('number');
      expect(imageHandler.maxSize).toBeGreaterThan(0);
    });

    it('should have supported formats array', () => {
      expect(imageHandler.supportedFormats).toBeDefined();
      expect(Array.isArray(imageHandler.supportedFormats)).toBe(true);
      expect(imageHandler.supportedFormats.length).toBeGreaterThan(0);
    });

    it('should support common image formats', () => {
      expect(imageHandler.supportedFormats).toContain('image/jpeg');
      expect(imageHandler.supportedFormats).toContain('image/png');
      expect(imageHandler.supportedFormats).toContain('image/webp');
    });

    it('should have configured image quality', () => {
      expect(imageHandler.imageQuality).toBeDefined();
      expect(typeof imageHandler.imageQuality).toBe('number');
      expect(imageHandler.imageQuality).toBeGreaterThan(0);
      expect(imageHandler.imageQuality).toBeLessThanOrEqual(100);
    });
  });

  describe('Image path handling', () => {
    it('should generate correct image paths with leading slash', async () => {
      const html = '<img src="/test.jpg" alt="Test">';
      const baseUrl = 'https://example.com/article';
      const articleTitle = 'Test Article';

      // Create a mock fetch response
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          headers: {
            get: (header) => {
              if (header === 'content-type') return 'image/jpeg';
              if (header === 'content-length') return '1000';
              return null;
            }
          },
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000))
        })
      );

      const result = await imageHandler.downloadAndReplaceImages(html, baseUrl, articleTitle);

      // Check that image paths start with /images/
      for (const image of result.images) {
        expect(image.localPath).toMatch(/^\/images\//);
      }

      // Cleanup mock
      global.fetch = undefined;
    });
  });
});
