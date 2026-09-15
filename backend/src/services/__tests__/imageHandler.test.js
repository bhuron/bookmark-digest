import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import sharp from 'sharp';
import imageHandler from '../imageHandler.js';
import fs from 'fs/promises';
import path from 'path';

describe('ImageHandler', () => {
  // Some tests download for real, straight into the application images
  // directory. Record what was already there, then remove anything this suite
  // creates so a test run never leaves artifacts behind.
  const imagesDir = path.resolve(imageHandler.baseImagesDir);
  let preexisting;

  beforeAll(async () => {
    preexisting = new Set(await fs.readdir(imagesDir).catch(() => []));
  });

  afterEach(async () => {
    const entries = await fs.readdir(imagesDir).catch(() => []);

    for (const entry of entries) {
      if (!preexisting.has(entry)) {
        await fs.rm(path.join(imagesDir, entry), { recursive: true, force: true });
      }
    }
  });

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
        getAttribute: function(_attr) { return null; }
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
        getAttribute: function(_attr) { return null; }
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
    const articleDir = path.join(
      path.resolve(imageHandler.baseImagesDir),
      `test-article-${imageHandler._urlHash('https://example.com/article')}`
    );

    afterEach(async () => {
      await fs.rm(articleDir, { recursive: true, force: true });
    });

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

  describe('lazy directory creation', () => {
    const url = 'https://example.com/no-images';
    const articleDir = path.join(
      path.resolve(imageHandler.baseImagesDir),
      `no-images-${imageHandler._urlHash(url)}`
    );

    afterEach(async () => {
      await fs.rm(articleDir, { recursive: true, force: true });
      global.fetch = undefined;
    });

    it('should not create a directory for an article without images', async () => {
      const result = await imageHandler.downloadAndReplaceImages(
        '<p>This article has no images at all.</p>',
        url,
        'No Images'
      );

      expect(result.images).toEqual([]);
      await expect(fs.access(articleDir)).rejects.toThrow();
    });

    it('should not create a directory when every image download fails', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' })
      );

      const result = await imageHandler.downloadAndReplaceImages(
        '<img src="/missing.jpg" alt="Missing">',
        url,
        'No Images'
      );

      expect(result.images).toEqual([]);
      await expect(fs.access(articleDir)).rejects.toThrow();
    });
  });

  describe('deleteImageFiles', () => {
    const imagesDir = path.resolve(imageHandler.baseImagesDir);
    const testDirName = `__test-cleanup-${process.pid}`;
    const testDir = path.join(imagesDir, testDirName);

    beforeEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should delete recorded files and prune the directory once empty', async () => {
      const file = path.join(testDir, 'image-0.jpg');
      await fs.writeFile(file, 'data');

      const removed = await imageHandler.deleteImageFiles([`/images/${testDirName}/image-0.jpg`]);

      expect(removed).toBe(1);
      await expect(fs.access(file)).rejects.toThrow();
      await expect(fs.access(testDir)).rejects.toThrow();
    });

    it('should keep a directory that still holds another article image', async () => {
      const mine = path.join(testDir, 'image-0.jpg');
      const other = path.join(testDir, 'image-1.jpg');
      await fs.writeFile(mine, 'mine');
      await fs.writeFile(other, 'other');

      const removed = await imageHandler.deleteImageFiles([`/images/${testDirName}/image-0.jpg`]);

      expect(removed).toBe(1);
      await expect(fs.access(other)).resolves.toBeUndefined();
      await expect(fs.access(testDir)).resolves.toBeUndefined();
    });

    it('should tolerate files that are already gone', async () => {
      const removed = await imageHandler.deleteImageFiles([`/images/${testDirName}/missing.jpg`]);
      expect(removed).toBe(0);
    });

    it('should refuse to delete anything outside the images directory', async () => {
      const outside = path.join(imagesDir, '..', `__outside-${process.pid}.txt`);
      await fs.writeFile(outside, 'must survive');

      const removed = await imageHandler.deleteImageFiles([
        `/images/../../${path.basename(outside)}`,
        '/etc/passwd',
        'images/no-leading-slash.jpg',
        '/images/'
      ]);

      expect(removed).toBe(0);
      await expect(fs.access(outside)).resolves.toBeUndefined();

      await fs.rm(outside, { force: true });
    });
  });

  describe('image directory naming', () => {
    const imagesDir = path.resolve(imageHandler.baseImagesDir);
    const firstUrl = 'https://example.com/article';
    const secondUrl = 'https://example.com/another-article';

    const dirFor = (url) => path.join(imagesDir, `shared-title-${imageHandler._urlHash(url)}`);

    afterEach(async () => {
      await fs.rm(dirFor(firstUrl), { recursive: true, force: true });
      await fs.rm(dirFor(secondUrl), { recursive: true, force: true });
    });

    it('should derive a stable per-URL hash', () => {
      const hash = imageHandler._urlHash(firstUrl);

      expect(hash).toHaveLength(10);
      expect(imageHandler._urlHash(firstUrl)).toBe(hash);
      expect(imageHandler._urlHash(secondUrl)).not.toBe(hash);
    });

    it('should isolate two articles that share the same title', async () => {
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

      const html = '<img src="/test.jpg" alt="Test">';
      const first = await imageHandler.downloadAndReplaceImages(html, firstUrl, 'Shared Title');
      const second = await imageHandler.downloadAndReplaceImages(html, secondUrl, 'Shared Title');

      expect(first.images).toHaveLength(1);
      expect(second.images).toHaveLength(1);
      expect(first.images[0].localPath).toContain(`/images/shared-title-${imageHandler._urlHash(firstUrl)}/`);
      expect(second.images[0].localPath).toContain(`/images/shared-title-${imageHandler._urlHash(secondUrl)}/`);
      expect(first.images[0].localPath).not.toBe(second.images[0].localPath);

      global.fetch = undefined;
    });
  });

  describe('image format handling', () => {
    const url = 'https://example.com/format-test';
    const articleDir = path.join(
      path.resolve(imageHandler.baseImagesDir),
      `format-test-${imageHandler._urlHash(url)}`
    );
    const html = '<img src="/photo" alt="Photo">';

    let sourceJpeg;
    let sourceWebp;

    beforeAll(async () => {
      sourceJpeg = await sharp({
        create: { width: 8, height: 8, channels: 3, background: '#336699' }
      }).jpeg().toBuffer();

      sourceWebp = await sharp({
        create: { width: 8, height: 8, channels: 3, background: '#993366' }
      }).webp().toBuffer();
    });

    afterEach(async () => {
      await fs.rm(articleDir, { recursive: true, force: true });
      global.fetch = undefined;
    });

    const fakeResponse = (contentType, body) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: (header) => (header === 'content-type' ? contentType : null) },
      arrayBuffer: () => Promise.resolve(body)
    });

    const readSaved = async (localPath) => {
      const file = path.join(
        path.resolve(imageHandler.baseImagesDir),
        localPath.replace('/images/', '')
      );

      const buffer = await fs.readFile(file);
      return { buffer, meta: await sharp(buffer).metadata() };
    };

    it('should only advertise formats it can also read', () => {
      // The regression this guards: AVIF was requested in Accept and then
      // rejected, so every FT image was silently dropped
      const advertised = imageHandler.acceptHeader
        .split(',')
        .filter(part => !part.includes('*'));

      expect(advertised.length).toBeGreaterThan(0);
      for (const type of advertised) {
        expect(imageHandler.supportedFormats).toContain(type);
      }
    });

    it('should claim AVIF support exactly when sharp can decode it', () => {
      expect(imageHandler.supportedFormats.includes('image/avif'))
        .toBe(imageHandler.canDecodeAvif);
    });

    it('should re-encode a WebP as a real JPEG named .jpg', async () => {
      global.fetch = jest.fn(() => Promise.resolve(fakeResponse('image/webp', sourceWebp)));

      const result = await imageHandler.downloadAndReplaceImages(html, url, 'Format Test');

      expect(result.images).toHaveLength(1);
      expect(result.images[0].localPath).toMatch(/\.jpg$/);

      const saved = await readSaved(result.images[0].localPath);
      expect(saved.meta.format).toBe('jpeg');
    });

    it('should store a JPEG as JPEG without asking twice', async () => {
      global.fetch = jest.fn(() => Promise.resolve(fakeResponse('image/jpeg', sourceJpeg)));

      const result = await imageHandler.downloadAndReplaceImages(html, url, 'Format Test');

      expect(global.fetch).toHaveBeenCalledTimes(1);

      const saved = await readSaved(result.images[0].localPath);
      expect(saved.meta.format).toBe('jpeg');
    });

    it('should retry without modern formats when the first answer is unreadable', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(fakeResponse('image/jxl', Buffer.from('unsupported')))
        .mockResolvedValueOnce(fakeResponse('image/jpeg', sourceJpeg));

      const result = await imageHandler.downloadAndReplaceImages(html, url, 'Format Test');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch.mock.calls[1][1].headers.Accept)
        .toBe(imageHandler.fallbackAcceptHeader);

      expect(result.images).toHaveLength(1);

      const saved = await readSaved(result.images[0].localPath);
      expect(saved.meta.format).toBe('jpeg');
    });

    it('should skip the image when the retry is unreadable too', async () => {
      global.fetch = jest.fn(() => Promise.resolve(fakeResponse('image/jxl', Buffer.from('x'))));

      const result = await imageHandler.downloadAndReplaceImages(html, url, 'Format Test');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.images).toEqual([]);
    });
  });
});
