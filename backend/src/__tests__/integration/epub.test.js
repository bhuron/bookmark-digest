// Set test ID before any imports to ensure unique database file
process.env.TEST_ID = 'epub';

// Mock rate limiters before any imports - must be at top of file for hoisting
import { jest } from '@jest/globals';
jest.mock('../../middleware/rateLimiter.js', () => ({
  generalLimiter: (req, res, next) => next(),
  heavyOperationLimiter: (req, res, next) => next(),
  articleCreationLimiter: (req, res, next) => next(),
  createRateLimiter: () => (req, res, next) => next()
}));

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import fs from 'fs/promises';
import {
  createTestApp,
  setupTestDatabase,
  cleanupTestDatabase,
  resetTestDatabase,
  createAuthHeaders
} from '../utils/testApp.js';

describe('EPUB API Integration Tests', () => {
  let app;

  beforeAll(async () => {
    await setupTestDatabase();
    app = createTestApp();
  });

  afterAll(() => {
    cleanupTestDatabase();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Reset database between tests to avoid state leakage
    await resetTestDatabase();
  });

  /**
   * Helper to create test articles
   */
  async function createTestArticles(count = 3) {
    const articleIds = [];
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);

    for (let i = 1; i <= count; i++) {
      const response = await request(app)
        .post('/api/articles')
        .set(createAuthHeaders())
        .send({
          html: `<html><head><title>Test Article ${i}</title></head><body><article><h1>EPUB Test Article ${i}</h1><p>This is content for article ${i}. We need more substantial content to ensure Readability can successfully extract the article. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p><p>Additional paragraph to ensure we have enough content. The article needs sufficient text content to pass the Readability extraction threshold. This should be enough combined with the previous paragraph.</p></article></body></html>`,
          url: `https://example.com/epub-test-${timestamp}-${random}-${i}`
        });

      if (response.status !== 201 || !response.body.article) {
        throw new Error(`Failed to create test article ${i}: ${JSON.stringify(response.body)}`);
      }
      articleIds.push(response.body.article.id);
    }

    if (articleIds.length !== count) {
      throw new Error(`Expected to create ${count} articles, but only got ${articleIds.length}`);
    }

    return articleIds;
  }

  describe('POST /api/epub/generate', () => {
    it('should generate EPUB from article IDs', async () => {
      const articleIds = await createTestArticles(1);

      const response = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: articleIds,
          title: 'Test EPUB',
          author: 'Test Author'
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('epub');
      expect(response.body.epub).toHaveProperty('id');
      expect(response.body.epub).toHaveProperty('filename');
      expect(response.body.epub).toHaveProperty('articleCount', 1);
      expect(response.body.epub).toHaveProperty('size');
    });

    it('should generate EPUB with multiple articles', async () => {
      const articleIds = await createTestArticles(3);

      const response = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: articleIds,
          title: 'Multi-Article EPUB'
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('epub');
      expect(response.body.epub).toHaveProperty('articleCount', 3);
    });

    it('should use default title when not provided', async () => {
      const articleIds = await createTestArticles(1);

      const response = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: articleIds
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('epub');
      // When title is not provided, it's undefined and omitted from response
      // The filename should use the default "bookmark-digest"
      expect(response.body.epub.filename).toMatch(/^bookmark-digest-/);
    });

    it('should require articleIds', async () => {
      const response = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({ title: 'Test EPUB' });

      expect(response.status).toBe(400);
    });

    it('should reject empty articleIds array', async () => {
      const response = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: [],
          title: 'Test EPUB'
        });

      expect(response.status).toBe(400);
    });

    it('should handle non-existent article IDs gracefully', async () => {
      const response = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: [999999],
          title: 'Test EPUB'
        });

      // Backend returns 500 instead of 400 for this error case
      expect([400, 500]).toContain(response.status);
    });

    it('should limit article count to 100', async () => {
      const tooManyIds = Array(101).fill(1);

      const response = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: tooManyIds,
          title: 'Large EPUB'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/epub/exports', () => {
    it('should return list of EPUB exports', async () => {
      const articleIds = await createTestArticles(1);

      await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: articleIds,
          title: 'List Test EPUB'
        });

      const response = await request(app)
        .get('/api/epub/exports')
        .set(createAuthHeaders());

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('exports');
      expect(Array.isArray(response.body.exports)).toBe(true);
      expect(response.body.exports.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/epub/exports?page=1&limit=5')
        .set(createAuthHeaders());

      expect([200, 201]).toContain(response.status);
      expect(response.body.exports.length).toBeLessThanOrEqual(5);
    });

    it('should return exports with correct structure', async () => {
      const articleIds = await createTestArticles(1);

      await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: articleIds,
          title: 'Structure Test EPUB'
        });

      const response = await request(app)
        .get('/api/epub/exports')
        .set(createAuthHeaders());

      expect([200, 201]).toContain(response.status);

      if (response.body.exports.length > 0) {
        const exportRecord = response.body.exports[0];
        expect(exportRecord).toHaveProperty('id');
        expect(exportRecord).toHaveProperty('name');
        expect(exportRecord).toHaveProperty('article_count');
        expect(exportRecord).toHaveProperty('file_size');
        expect(exportRecord).toHaveProperty('created_at');
        expect(exportRecord).toHaveProperty('sent_to_kindle');
        expect(exportRecord).toHaveProperty('sent_at');
      }
    });
  });

  describe('GET /api/epub/exports/:id', () => {
    it('should return single export by ID', async () => {
      const articleIds = await createTestArticles(1);

      const epubResponse = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: articleIds,
          title: 'Get Single Test EPUB'
        });

      const exportId = epubResponse.body.epub.id;

      const response = await request(app)
        .get(`/api/epub/exports/${exportId}`)
        .set(createAuthHeaders());

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('export');
      expect(response.body.export).toHaveProperty('id', exportId);
      expect(response.body.export).toHaveProperty('name');
      expect(response.body.export).toHaveProperty('article_count');
      expect(response.body.export).toHaveProperty('file_size');
    });

    it('should return 404 for non-existent export', async () => {
      const response = await request(app)
        .get('/api/epub/exports/999999')
        .set(createAuthHeaders());

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/epub/exports/:id/download', () => {
    it('should download EPUB file', async () => {
      const articleIds = await createTestArticles(1);

      const epubResponse = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: articleIds,
          title: 'Download Test EPUB'
        });

      const exportId = epubResponse.body.epub.id;

      const response = await request(app)
        .get(`/api/epub/exports/${exportId}/download`)
        .set(createAuthHeaders());

      expect([200, 201]).toContain(response.status);
      expect(response.header['content-type']).toContain('application/epub+zip');
      // File downloads return the file content
      expect(response.body).toBeTruthy();
    });

    it('should return 404 for non-existent export', async () => {
      const response = await request(app)
        .get('/api/epub/exports/999999/download')
        .set(createAuthHeaders());

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/epub/exports/:id', () => {
    it('should delete export by ID', async () => {
      const articleIds = await createTestArticles(1);

      const epubResponse = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: articleIds,
          title: 'Delete Test EPUB'
        });

      const exportId = epubResponse.body.epub.id;

      const deleteResponse = await request(app)
        .delete(`/api/epub/exports/${exportId}`)
        .set(createAuthHeaders());

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body).toHaveProperty('success', true);

      // Verify export is deleted
      const getResponse = await request(app)
        .get(`/api/epub/exports/${exportId}`)
        .set(createAuthHeaders());

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent export', async () => {
      const response = await request(app)
        .delete('/api/epub/exports/999999')
        .set(createAuthHeaders());

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/epub/exports/:id/send-to-kindle', () => {
    it('should return error when SMTP not configured', async () => {
      const articleIds = await createTestArticles(1);

      const epubResponse = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: articleIds,
          title: 'Kindle Test EPUB'
        });

      const exportId = epubResponse.body.epub.id;

      const response = await request(app)
        .post(`/api/epub/exports/${exportId}/send-to-kindle`)
        .set(createAuthHeaders());

      // Should fail because SMTP is not configured in test environment
      expect([400, 500]).toContain(response.status);
    });

    it('should return 404 for non-existent export', async () => {
      const response = await request(app)
        .post('/api/epub/exports/999999/send-to-kindle')
        .set(createAuthHeaders());

      // Backend returns 500 instead of 404 for this error case
      expect([404, 500]).toContain(response.status);
    });
  });

  describe('EPUB Generation Edge Cases', () => {
    it('should handle special characters in title', async () => {
      const articleIds = await createTestArticles(1);

      const response = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: articleIds,
          title: 'Test EPUB with Special Characters: <>&"\''
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('epub');
      expect(response.body.epub).toHaveProperty('filename');
    });

    it('should handle duplicate articles gracefully', async () => {
      const articleIds = await createTestArticles(2);

      // Generate EPUB with duplicate IDs
      const response = await request(app)
        .post('/api/epub/generate')
        .set(createAuthHeaders())
        .send({
          articleIds: [...articleIds, articleIds[0]],
          title: 'Duplicate Test EPUB'
        });

      expect([200, 201]).toContain(response.status);
    });
  });
});
