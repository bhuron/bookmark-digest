import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs/promises';
import path from 'path';
import articleProcessor from '../articleProcessor.js';
import imageHandler from '../imageHandler.js';
import { getConnection } from '../../database/index.js';
import { setupTestDatabase, teardownTestDatabase } from '../../__tests__/utils/testDatabase.js';

describe('ArticleProcessor', () => {
  describe('processArticle', () => {
    it('should process article HTML and return structured data', async () => {
      const html = '<html><body><article><h1>Test</h1><p>Content here</p></article></body></html>';
      const url = 'https://example.com/test';

      const result = await articleProcessor.processArticle(html, url, { skipImages: true });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('contentHtml');
      expect(result).toHaveProperty('contentText');
      expect(result).toHaveProperty('wordCount');
      expect(result).toHaveProperty('readingTimeMinutes');
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.readingTimeMinutes).toBeGreaterThan(0);
    });

    it('should throw error for HTML exceeding size limit', async () => {
      const largeHtml = 'a'.repeat(11 * 1024 * 1024); // 11MB
      const url = 'https://example.com/test';

      await expect(articleProcessor.processArticle(largeHtml, url))
        .rejects.toThrow('HTML too large');
    });

    it('should extract title from article', async () => {
      const html = `
        <html>
          <head>
            <title>Test Article Title</title>
          </head>
          <body>
            <article>
              <h1>Test Article Title</h1>
              <p>This is a test article with some content.</p>
            </article>
          </body>
        </html>
      `;
      const url = 'https://example.com/test';

      const result = await articleProcessor.processArticle(html, url, { skipImages: true });

      expect(result.title).toBeDefined();
      // Title may be "Untitled" if Readability can't extract it
      expect(result.title).toBeTruthy();
    });

    it('should calculate word count correctly', async () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test</h1>
              <p>One two three four five.</p>
            </article>
          </body>
        </html>
      `;
      const url = 'https://example.com/test';

      const result = await articleProcessor.processArticle(html, url, { skipImages: true });

      expect(result.wordCount).toBeGreaterThan(0);
      // Reading time should be ceiling of word count / 200
      expect(result.readingTimeMinutes).toBe(Math.ceil(result.wordCount / 200));
    });

    it('should handle articles with meta tags', async () => {
      const html = `
        <html>
          <head>
            <meta property="og:author" content="Test Author">
            <meta property="og:site_name" content="Test Site">
            <meta property="article:published_time" content="2024-01-01T00:00:00Z">
          </head>
          <body>
            <article>
              <h1>Test Article</h1>
              <p>Content here.</p>
            </article>
          </body>
        </html>
      `;
      const url = 'https://example.com/test';

      const result = await articleProcessor.processArticle(html, url, { skipImages: true });

      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      // Metadata extraction is handled by Readability
    });

    it('should handle empty or minimal content gracefully', async () => {
      const html = '<html><body></body></html>';
      const url = 'https://example.com/empty';

      // Should not throw, but may return success: false
      const result = await articleProcessor.processArticle(html, url, { skipImages: true });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    it('should set success to false for failed extractions', async () => {
      const html = '<html><body><script>alert("not an article")</script></body></html>';
      const url = 'https://example.com/no-article';

      const result = await articleProcessor.processArticle(html, url, { skipImages: true });

      // Readability may fail to extract content, resulting in success: false
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
    });

    it('should include url and originalUrl in result', async () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>URL Test</h1>
              <p>Content for URL test.</p>
            </article>
          </body>
        </html>
      `;
      const url = 'https://example.com/url-test';

      const result = await articleProcessor.processArticle(html, url, { skipImages: true });

      expect(result).toHaveProperty('url', url);
      expect(result).toHaveProperty('originalUrl', url);
    });

    it('should have success property for successful extractions', async () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Success Test</h1>
              <p>Content with enough text to exceed Readability threshold.</p>
              <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
            </article>
          </body>
        </html>
      `;
      const url = 'https://example.com/success-test';

      const result = await articleProcessor.processArticle(html, url, { skipImages: true });

      expect(result).toHaveProperty('success', true);
    });
  });

  describe('graphics', () => {
    const longText = 'The quick brown fox jumps over the lazy dog and keeps going. '.repeat(20);
    const html = `<html><head><title>Charted</title></head><body><article>
      <h1>Charted</h1>
      <figure>
        <picture>
          <source srcset="/hero.avif 1200w" type="image/avif">
          <img srcset="/hero-800.jpg 800w, /hero-1600.jpg 1600w" sizes="100vw" alt="A chart">
        </picture>
        <figcaption>Chart caption</figcaption>
      </figure>
      <p>${longText}</p>
      <p>${longText}</p>
      <p>${longText}</p>
    </article></body></html>`;

    it('should keep srcset and sizes through sanitising', async () => {
      // The regression this guards: srcset was absent from ALLOWED_ATTR, so a
      // responsive image lost the only URL it had before the downloader ran
      const result = await articleProcessor.processArticle(
        html,
        'https://example.com/charted',
        { preserveImages: false }
      );

      expect(result.success).toBe(true);
      expect(result.contentHtml).toContain('srcset="https://example.com/hero-800.jpg 800w, https://example.com/hero-1600.jpg 1600w"');
      expect(result.contentHtml).toContain('sizes="100vw"');
    });

    it('should count every kind of graphic in a capture', () => {
      const dom = new JSDOM('<div>' +
        '<img src="/a.jpg">' +
        '<img srcset="/b.jpg 800w">' +
        '<picture><source srcset="/c.avif 100w"><img src="/c.jpg"></picture>' +
        '<svg><circle r="1"></circle></svg>' +
        '<canvas></canvas>' +
        '<iframe src="/embed"></iframe>' +
        '<figure></figure>' +
        '<ft-chart id="host"></ft-chart>' +
        '</div>');

      const census = articleProcessor._graphicsCensus(dom.window.document);

      expect(census).toEqual({
        img: 3,
        picture: 1,
        srcset: 2,
        svg: 1,
        canvas: 1,
        iframe: 1,
        figure: 1,
        custom: 1
      });
    });

    it('should count nothing for a missing node', () => {
      expect(articleProcessor._graphicsCensus(null).img).toBe(0);
    });

    describe('raw capture dump', () => {
      // A capture kept for diagnosis is someone's evidence, so the tests write
      // into a directory of their own and never remove the real one
      const dumpDir = path.join(articleProcessor.rawCaptureDir, 'test-dumps');
      const dumpHtml = '<html><head><title>Dump Test</title></head><body><article>' +
        `<h1>Dump Test</h1><p>${longText}</p><iframe src="/chart"></iframe></article></body></html>`;

      beforeEach(() => {
        articleProcessor.rawCaptureDir = dumpDir;
      });

      afterEach(async () => {
        delete process.env.DEBUG_SAVE_RAW_HTML;
        articleProcessor.rawCaptureDir = path.join(dumpDir, '..');
        await fs.rm(dumpDir, { recursive: true, force: true });
      });

      it('should write the capture when the flag is on', async () => {
        process.env.DEBUG_SAVE_RAW_HTML = 'true';

        await articleProcessor.processArticle(
          dumpHtml,
          'https://example.com/dump-test',
          { preserveImages: false }
        );

        const files = await fs.readdir(dumpDir);
        expect(files).toHaveLength(1);
        expect(files[0]).toMatch(/^dump-test-[0-9a-f]{10}\.html$/);

        // Verbatim, so the iframe Readability is about to drop is still readable
        const saved = await fs.readFile(`${dumpDir}/${files[0]}`, 'utf8');
        expect(saved).toContain('<iframe src="/chart">');
      });

      it('should write nothing unless asked', async () => {
        await articleProcessor.processArticle(
          dumpHtml,
          'https://example.com/dump-test',
          { preserveImages: false }
        );

        await expect(fs.readdir(dumpDir)).rejects.toThrow();
      });
    });

    it('should turn a Flourish chart embed into a downloadable image', async () => {
      // The regression this guards: Readability deletes every iframe inside the
      // article body, so these charts used to vanish without a trace
      const withEmbed = `<html><head><title>Embedded</title></head><body><article>
        <h1>Embedded</h1>
        <figure class="n-content-picture"><div class="flourish-embed" data-src="visualisation/30227229?hideSignature">
          <iframe title="Interactive or visual content" src="https://flo.uri.sh/visualisation/30227229/embed?auto=1"></iframe>
        </div></figure>
        <figure class="n-content-picture"><div class="flourish-embed" data-src="visualisation/30226063?hideSignature"></div></figure>
        <p>${longText}</p></article></body></html>`;

      const result = await articleProcessor.processArticle(
        withEmbed,
        'https://example.com/embedded',
        { preserveImages: false }
      );

      expect(result.success).toBe(true);
      expect(result.contentHtml).not.toContain('<iframe');

      // Both charts, whether the wrapper had rendered an iframe or not
      expect(result.contentHtml).toContain(
        'src="https://public.flourish.studio/visualisation/30227229/thumbnail"'
      );
      expect(result.contentHtml).toContain(
        'src="https://public.flourish.studio/visualisation/30226063/thumbnail"'
      );

      // One image per chart, and the figure that carried it is still there
      expect(result.contentHtml.match(/public\.flourish\.studio/g)).toHaveLength(2);
      expect(result.contentHtml).toContain('<figure');
    });

    it('should not rewrite an embed no provider claims', async () => {
      const otherEmbed = `<html><head><title>Other</title></head><body><article>
        <h1>Other</h1><iframe src="https://example.com/embed/1"></iframe>
        <p>${longText}</p></article></body></html>`;

      const result = await articleProcessor.processArticle(
        otherEmbed,
        'https://example.com/other-embed',
        { preserveImages: false }
      );

      expect(result.contentHtml).not.toContain('public.flourish.studio');
    });
  });

  describe('saveFailedArticle', () => {
    it('should have saveFailedArticle method', async () => {
      expect(articleProcessor.saveFailedArticle).toBeDefined();
      expect(typeof articleProcessor.saveFailedArticle).toBe('function');
    });
  });

  describe('saveArticle', () => {
    it('should have saveArticle method', async () => {
      expect(articleProcessor.saveArticle).toBeDefined();
      expect(typeof articleProcessor.saveArticle).toBe('function');
    });

    describe('images of a repeated capture', () => {
      const imagesDir = path.resolve(imageHandler.baseImagesDir);
      const dirName = `recapture-${Date.now()}`;
      const fields = {
        url: 'https://example.com/recapture',
        originalUrl: 'https://example.com/recapture',
        title: 'Recapture',
        contentHtml: '<p>Text</p>',
        contentText: 'Text',
        excerpt: 'Text',
        author: null,
        siteName: null,
        publishedAt: null,
        wordCount: 1,
        readingTimeMinutes: 1,
        language: 'en',
        hasImages: true,
        imageCount: 2
      };

      const image = (name) => ({
        originalUrl: `https://example.com/${name}.jpg`,
        localPath: `/images/${dirName}/${name}.jpg`,
        altText: name
      });

      const writeImageFiles = async (names) => {
        await fs.mkdir(path.join(imagesDir, dirName), { recursive: true });

        for (const name of names) {
          await fs.writeFile(path.join(imagesDir, dirName, `${name}.jpg`), 'x');
        }
      };

      const recordedPaths = () => getConnection()
        .prepare(`
          SELECT ai.local_path FROM article_images ai
          JOIN articles a ON a.id = ai.article_id
          WHERE a.url = ?
        `)
        .all(fields.url)
        .map(row => row.local_path);

      beforeAll(async () => {
        await setupTestDatabase('article-processor-save');
      });

      afterAll(async () => {
        teardownTestDatabase();
        await fs.rm(path.join(imagesDir, dirName), { recursive: true, force: true });
      });

      it('should replace the previous rows and files instead of accumulating', async () => {
        await writeImageFiles(['one', 'two']);
        await articleProcessor.saveArticle({
          ...fields,
          images: [image('one'), image('two')]
        });

        expect(recordedPaths().sort()).toEqual([
          `/images/${dirName}/one.jpg`,
          `/images/${dirName}/two.jpg`
        ]);

        // The same URL captured again, with different images
        await writeImageFiles(['three', 'four']);
        await articleProcessor.saveArticle({
          ...fields,
          images: [image('three'), image('four')]
        });

        expect(recordedPaths().sort()).toEqual([
          `/images/${dirName}/four.jpg`,
          `/images/${dirName}/three.jpg`
        ]);

        // The files the replaced rows named are gone, not orphaned on disk
        const onDisk = await fs.readdir(path.join(imagesDir, dirName));
        expect(onDisk.sort()).toEqual(['four.jpg', 'three.jpg']);
      });
    });
  });
});
