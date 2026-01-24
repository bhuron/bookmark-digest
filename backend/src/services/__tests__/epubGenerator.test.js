import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import epubGenerator from '../epubGenerator.js';
import fs from 'fs/promises';
import path from 'path';

describe('EPUBGenerator', () => {
  describe('listExports', () => {
    it('should have listExports method', () => {
      expect(epubGenerator.listExports).toBeDefined();
      expect(typeof epubGenerator.listExports).toBe('function');
    });

    it('should return array of exports', () => {
      const result = epubGenerator.listExports(10);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getExport', () => {
    it('should have getExport method', () => {
      expect(epubGenerator.getExport).toBeDefined();
      expect(typeof epubGenerator.getExport).toBe('function');
    });

    it('should throw error for non-existent export', () => {
      expect(() => {
        epubGenerator.getExport(999999);
      }).toThrow('Export not found');
    });
  });

  describe('_sanitizeFilename', () => {
    it('should sanitize filenames by removing special characters', () => {
      const filename = epubGenerator._sanitizeFilename('Test Title! With Special @#$ Characters');
      expect(filename).toMatch(/^[a-z0-9-]+$/);
      expect(filename).not.toContain('!');
      expect(filename).not.toContain('@');
      expect(filename).not.toContain('#');
      expect(filename).not.toContain('$');
    });

    it('should convert to lowercase', () => {
      const filename = epubGenerator._sanitizeFilename('UPPERCASE Title');
      expect(filename).toBe(filename.toLowerCase());
    });

    it('should replace spaces with hyphens', () => {
      const filename = epubGenerator._sanitizeFilename('test title here');
      expect(filename).toContain('-');
      expect(filename).not.toContain(' ');
    });

    it('should truncate long filenames', () => {
      const longTitle = 'a'.repeat(100);
      const filename = epubGenerator._sanitizeFilename(longTitle);
      expect(filename.length).toBeLessThanOrEqual(50);
    });

    it('should remove leading and trailing hyphens', () => {
      const filename = epubGenerator._sanitizeFilename('---test---');
      expect(filename).not.toMatch(/^-|-$/);
    });
  });

  describe('_escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(epubGenerator._escapeHtml('<div>')).toBe('&lt;div&gt;');
      expect(epubGenerator._escapeHtml('&')).toBe('&amp;');
      expect(epubGenerator._escapeHtml('"')).toBe('&quot;');
      expect(epubGenerator._escapeHtml("'")).toBe('&#039;');
    });

    it('should handle empty input', () => {
      expect(epubGenerator._escapeHtml('')).toBe('');
      expect(epubGenerator._escapeHtml(null)).toBe('');
      expect(epubGenerator._escapeHtml(undefined)).toBe('');
    });

    it('should escape mixed content', () => {
      const input = '<script>alert("XSS")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
      expect(epubGenerator._escapeHtml(input)).toBe(expected);
    });
  });

  describe('_prepareCss', () => {
    it('should return CSS string', () => {
      const css = epubGenerator._prepareCss();
      expect(typeof css).toBe('string');
      expect(css.length).toBeGreaterThan(0);
    });

    it('should include body styles', () => {
      const css = epubGenerator._prepareCss();
      expect(css).toContain('body');
      expect(css).toContain('font-family');
    });

    it('should include heading styles', () => {
      const css = epubGenerator._prepareCss();
      expect(css).toContain('h1');
      expect(css).toContain('h2');
      expect(css).toContain('h3');
    });

    it('should include image styles', () => {
      const css = epubGenerator._prepareCss();
      expect(css).toContain('img');
      expect(css).toContain('max-width');
    });

    it('should include metadata class styles', () => {
      const css = epubGenerator._prepareCss();
      expect(css).toContain('.metadata');
      expect(css).toContain('color:');
    });
  });

  describe('_prepareArticleContent', () => {
    it('should prepare article content with chapter number', () => {
      const article = {
        title: 'Test Article',
        content_html: '<p>Test content</p>',
        author: 'Test Author',
        site_name: 'Test Site',
        published_at: '2024-01-01T00:00:00Z',
        url: 'https://example.com/test'
      };

      const content = epubGenerator._prepareArticleContent(article, 1);
      expect(content).toContain('Chapter 1');
      expect(content).toContain('Test Article');
      expect(content).toContain('Test Author');
      expect(content).toContain('Test Site');
      expect(content).toContain('https://example.com/test');
    });

    it('should handle missing metadata', () => {
      const article = {
        title: 'Test Article',
        content_html: '<p>Test content</p>',
        author: null,
        site_name: null,
        published_at: null,
        url: 'https://example.com/test'
      };

      const content = epubGenerator._prepareArticleContent(article, 2);
      expect(content).toContain('Chapter 2');
      expect(content).toContain('Test Article');
      expect(content).toContain('https://example.com/test');
    });

    it('should escape HTML in metadata', () => {
      const article = {
        title: '<script>alert("XSS")</script>',
        content_html: '<p>Test content</p>',
        author: 'Test Author',
        site_name: null,
        published_at: null,
        url: 'https://example.com/test'
      };

      const content = epubGenerator._prepareArticleContent(article, 1);
      expect(content).not.toContain('<script>');
      expect(content).toContain('&lt;script&gt;');
    });
  });

  describe('_htmlToXhtml', () => {
    it('should convert HTML entities to XML entities', () => {
      const html = '<p>Test&nbsp;content&nbsp;&ndash;with&mdash;entities</p>';
      const xhtml = epubGenerator._htmlToXhtml(html);
      expect(xhtml).toContain('&#160;');
      expect(xhtml).toContain('&#8211;');
      expect(xhtml).toContain('&#8212;');
    });

    it('should close self-closing tags', () => {
      const html = '<p>Test<br>content<hr>here</p>';
      const xhtml = epubGenerator._htmlToXhtml(html);
      expect(xhtml).toContain('<br/>');
      expect(xhtml).toContain('<hr/>');
    });

    it('should handle empty input', () => {
      expect(epubGenerator._htmlToXhtml('')).toBe('');
      expect(epubGenerator._htmlToXhtml(null)).toBe('');
    });

    it('should preserve valid HTML structure', () => {
      const html = '<p>Test content</p>';
      const xhtml = epubGenerator._htmlToXhtml(html);
      expect(xhtml).toContain('<p>');
      expect(xhtml).toContain('Test content');
    });
  });

  describe('generateFromArticles', () => {
    it('should have generateFromArticles method', () => {
      expect(epubGenerator.generateFromArticles).toBeDefined();
      expect(typeof epubGenerator.generateFromArticles).toBe('function');
    });

    it('should throw error for empty article array', async () => {
      await expect(epubGenerator.generateFromArticles([]))
        .rejects.toThrow('No valid articles found');
    });

    it('should throw error when no articles found in database', async () => {
      // Using non-existent article IDs
      await expect(epubGenerator.generateFromArticles([999999, 999998]))
        .rejects.toThrow();
    });
  });

  describe('_processImagesInHtml', () => {
    it('should remove picture tags and keep img', () => {
      const html = '<picture><source srcset="image.webp"><img src="image.jpg" alt="Test"></picture>';
      const processed = epubGenerator._processImagesInHtml(html);
      expect(processed).not.toContain('<picture>');
      expect(processed).not.toContain('<source');
      expect(processed).toContain('<img');
    });

    it('should handle non-existent local images', () => {
      const html = '<img src="/images/non-existent.jpg" alt="Test">';
      const processed = epubGenerator._processImagesInHtml(html);
      // Non-existent images should be removed or handled gracefully
      expect(processed).not.toContain('/images/non-existent.jpg');
    });
  });

  describe('EPUB Generation Integration', () => {
    it('should have ensureOutputDir method', () => {
      expect(epubGenerator.ensureOutputDir).toBeDefined();
      expect(typeof epubGenerator.ensureOutputDir).toBe('function');
    });

    it('should have _fileExists helper method', () => {
      expect(epubGenerator._fileExists).toBeDefined();
      expect(typeof epubGenerator._fileExists).toBe('function');
    });
  });
});
