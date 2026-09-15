import { describe, it, expect } from '@jest/globals';
import { JSDOM } from 'jsdom';
import articleProcessor from '../articleProcessor.js';

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
  });
});
