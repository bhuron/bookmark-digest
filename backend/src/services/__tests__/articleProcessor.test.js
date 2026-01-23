import { jest, describe, it, expect } from '@jest/globals';

// Mock external dependencies
jest.mock('@mozilla/readability', () => ({
  Readability: jest.fn().mockImplementation(() => ({
    parse: jest.fn().mockReturnValue({
      title: 'Test Article',
      content: '<article><h1>Test Article</h1><p>Content</p></article>',
      textContent: 'Test Article Content',
      excerpt: 'Test excerpt',
      byline: 'Test Author',
      siteName: 'Test Site',
      publishedTime: '2024-01-01T00:00:00Z',
      lang: 'en'
    })
  }))
}));

jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation((html) => ({
    window: {
      document: {
        documentElement: {
          outerHTML: html
        }
      }
    }
  })),
  VirtualConsole: jest.fn().mockImplementation(() => ({
    on: jest.fn()
  }))
}));

jest.mock('dompurify', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    sanitize: jest.fn().mockImplementation((html) => html)
  })
}));

// Mock internal dependencies
jest.mock('../imageHandler.js', () => ({
  default: {
    downloadAndReplaceImages: jest.fn().mockResolvedValue({
      html: '<article><h1>Test Article</h1><p>Content</p></article>',
      images: []
    })
  }
}));

jest.mock('../utils/logger.js', () => ({
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../database/index.js', () => ({
  getConnection: jest.fn()
}));

// Import articleProcessor after mocks
import articleProcessor from '../articleProcessor.js';

describe('ArticleProcessor', () => {
  describe('processArticle', () => {
    it('should process article HTML and return structured data', async () => {
      const html = '<html><body><article><h1>Test</h1><p>Content</p></article></body></html>';
      const url = 'https://example.com/test';

      const result = await articleProcessor.processArticle(html, url);

      expect(result).toHaveProperty('title', 'Test Article');
      expect(result).toHaveProperty('contentHtml');
      expect(result).toHaveProperty('contentText');
      expect(result).toHaveProperty('author', 'Test Author');
      expect(result).toHaveProperty('siteName', 'Test Site');
      expect(result).toHaveProperty('wordCount');
      expect(result).toHaveProperty('readingTimeMinutes');
    });

    it('should throw error for HTML exceeding size limit', async () => {
      const largeHtml = 'a'.repeat(11 * 1024 * 1024); // 11MB
      const url = 'https://example.com/test';

      await expect(articleProcessor.processArticle(largeHtml, url))
        .rejects.toThrow('HTML too large');
    });
  });
});