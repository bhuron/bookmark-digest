// Set test ID before any imports to ensure unique database file
process.env.TEST_ID = 'articles';

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
import {
  createTestApp,
  setupTestDatabase,
  cleanupTestDatabase,
  resetTestDatabase,
  createAuthHeaders
} from '../utils/testApp.js';

describe('Articles API Integration Tests', () => {
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

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await request(app)
        .get('/api/articles');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .get('/api/articles')
        .set('X-API-Key', 'invalid-api-key');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept requests with valid API key', async () => {
      const response = await request(app)
        .get('/api/articles')
        .set(createAuthHeaders());

      // Should return 200 with empty array (no articles yet)
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data.articles)).toBe(true);
    });
  });

  describe('POST /api/articles', () => {
    const validArticle = {
      html: '<html><body><article><h1>Test Article</h1><p>This is a test article with sufficient content to pass the Readability threshold.</p><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p></article></body></html>',
      url: 'https://example.com/test-article'
    };

    it('should create a new article with valid data', async () => {
      const response = await request(app)
        .post('/api/articles')
        .set(createAuthHeaders())
        .send(validArticle);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('article');
      expect(response.body.article).toHaveProperty('id');
      expect(response.body.article).toHaveProperty('title');
      expect(response.body.article).toHaveProperty('url', validArticle.url);
      expect(response.body.article).toHaveProperty('wordCount');
      expect(response.body.article).toHaveProperty('readingTimeMinutes');
    });

    it('should require html field', async () => {
      const response = await request(app)
        .post('/api/articles')
        .set(createAuthHeaders())
        .send({ url: 'https://example.com/test' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should require url field', async () => {
      const response = await request(app)
        .post('/api/articles')
        .set(createAuthHeaders())
        .send({ html: '<html><body><article><h1>Test</h1><p>Content</p></article></body></html>' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid URL format', async () => {
      const response = await request(app)
        .post('/api/articles')
        .set(createAuthHeaders())
        .send({
          html: validArticle.html,
          url: 'not-a-valid-url'
        });

      expect(response.status).toBe(400);
    });

    it('should handle HTML that exceeds size limit', async () => {
      const largeHtml = '<html><body><article>' + 'a'.repeat(11 * 1024 * 1024) + '</article></body></html>';

      const response = await request(app)
        .post('/api/articles')
        .set(createAuthHeaders())
        .send({
          html: largeHtml,
          url: 'https://example.com/too-large'
        });

      // Express returns 413 (Payload Too Large) for bodies exceeding the limit
      expect([400, 413]).toContain(response.status);
    });

    it('should upsert article with same URL', async () => {
      const articleData = {
        html: '<html><body><article><h1>Original Title</h1><p>Original content with enough text to pass Readability extraction.</p></article></body></html>',
        url: 'https://example.com/upsert-test'
      };

      // Create first article
      const response1 = await request(app)
        .post('/api/articles')
        .set(createAuthHeaders())
        .send(articleData);

      expect(response1.status).toBe(201);
      const firstId = response1.body.article.id;

      // Update with new content
      articleData.html = '<html><body><article><h1>Updated Title</h1><p>Updated content with enough text to pass Readability extraction.</p></article></body></html>';

      const response2 = await request(app)
        .post('/api/articles')
        .set(createAuthHeaders())
        .send(articleData);

      expect(response2.status).toBe(201);
      // The ID should be the same (upsert)
      expect(response2.body.article.id).toBe(firstId);
    });
  });

  describe('GET /api/articles', () => {
    beforeEach(async () => {
      // Create some test articles
      const articles = [
        { html: '<html><body><article><h1>Article 1</h1><p>Content for article 1 with sufficient text.</p></article></body></html>', url: 'https://example.com/1' },
        { html: '<html><body><article><h1>Article 2</h1><p>Content for article 2 with sufficient text.</p></article></body></html>', url: 'https://example.com/2' },
        { html: '<html><body><article><h1>Article 3</h1><p>Content for article 3 with sufficient text.</p></article></body></html>', url: 'https://example.com/3' }
      ];

      for (const article of articles) {
        await request(app)
          .post('/api/articles')
          .set(createAuthHeaders())
          .send(article);
      }
    });

    it('should return list of articles', async () => {
      const response = await request(app)
        .get('/api/articles')
        .set(createAuthHeaders());

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('articles');
      expect(Array.isArray(response.body.data.articles)).toBe(true);
      expect(response.body.data.articles.length).toBeGreaterThanOrEqual(3);
    });

    it('should support pagination with page and limit', async () => {
      const response = await request(app)
        .get('/api/articles?page=1&limit=2')
        .set(createAuthHeaders());

      expect(response.status).toBe(200);
      expect(response.body.data.articles.length).toBeLessThanOrEqual(2);
    });

    it('should support search by title', async () => {
      const response = await request(app)
        .get('/api/articles?search=Article')
        .set(createAuthHeaders());

      expect(response.status).toBe(200);
      expect(response.body.data.articles.length).toBeGreaterThan(0);
      // All results should contain the search term
      response.body.data.articles.forEach(article => {
        const matchesTitle = article.title?.toLowerCase().includes('article');
        const matchesContent = article.content_text?.toLowerCase().includes('article');
        expect(matchesTitle || matchesContent).toBe(true);
      });
    });

    it('should support filtering by is_archived', async () => {
      // Archive an article first
      const listResponse = await request(app)
        .get('/api/articles')
        .set(createAuthHeaders());

      const articleId = listResponse.body.data.articles[0].id;

      await request(app)
        .put(`/api/articles/${articleId}`)
        .set(createAuthHeaders())
        .send({ is_archived: true });

      // Get only archived articles
      const response = await request(app)
        .get('/api/articles?is_archived=true')
        .set(createAuthHeaders());

      expect(response.status).toBe(200);
      // The API returns booleans for is_archived
      response.body.data.articles.forEach(article => {
        expect(article.is_archived).toBe(true);
      });
    });

    it('should support sorting by different fields', async () => {
      const response = await request(app)
        .get('/api/articles?sort_by=title')
        .set(createAuthHeaders());

      expect(response.status).toBe(200);
      // Results should be sorted
      expect(response.body.data.articles.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/articles/:id', () => {
    let articleId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/articles')
        .set(createAuthHeaders())
        .send({
          html: '<html><body><article><h1>Single Article Test</h1><p>This is content for a single article test with enough text to pass extraction.</p></article></body></html>',
          url: 'https://example.com/single-test'
        });

      articleId = response.body.article.id;
    });

    it('should return single article by ID', async () => {
      const response = await request(app)
        .get(`/api/articles/${articleId}`)
        .set(createAuthHeaders());

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('article');
      expect(response.body.article).toHaveProperty('id', articleId);
      expect(response.body.article).toHaveProperty('title');
      expect(response.body.article).toHaveProperty('content_html');
      expect(response.body.article).toHaveProperty('content_text');
    });

    it('should return 404 for non-existent article', async () => {
      const response = await request(app)
        .get('/api/articles/999999')
        .set(createAuthHeaders());

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/articles/:id', () => {
    let articleId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/articles')
        .set(createAuthHeaders())
        .send({
          html: '<html><body><article><h1>Update Test</h1><p>Content for update test with sufficient text.</p></article></body></html>',
          url: 'https://example.com/update-test'
        });

      articleId = response.body.article.id;
    });

    it('should update article title', async () => {
      const response = await request(app)
        .put(`/api/articles/${articleId}`)
        .set(createAuthHeaders())
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should update article is_archived status', async () => {
      const response = await request(app)
        .put(`/api/articles/${articleId}`)
        .set(createAuthHeaders())
        .send({ is_archived: true });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should update article is_favorite status', async () => {
      const response = await request(app)
        .put(`/api/articles/${articleId}`)
        .set(createAuthHeaders())
        .send({ is_favorite: true });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should reject invalid field updates', async () => {
      const response = await request(app)
        .put(`/api/articles/${articleId}`)
        .set(createAuthHeaders())
        .send({ invalid_field: 'value' });

      // Should return 400 when no valid fields are provided
      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent article', async () => {
      const response = await request(app)
        .put('/api/articles/999999')
        .set(createAuthHeaders())
        .send({ title: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/articles/:id', () => {
    let articleId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/articles')
        .set(createAuthHeaders())
        .send({
          html: '<html><body><article><h1>Delete Test</h1><p>Content for delete test with sufficient text.</p></article></body></html>',
          url: 'https://example.com/delete-test'
        });

      articleId = response.body.article.id;
    });

    it('should delete article by ID', async () => {
      const deleteResponse = await request(app)
        .delete(`/api/articles/${articleId}`)
        .set(createAuthHeaders());

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body).toHaveProperty('success', true);

      // Verify article is deleted
      const getResponse = await request(app)
        .get(`/api/articles/${articleId}`)
        .set(createAuthHeaders());

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent article', async () => {
      const response = await request(app)
        .delete('/api/articles/999999')
        .set(createAuthHeaders());

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/articles/stats', () => {
    beforeEach(async () => {
      // Create test articles with different states
      const articles = [
        { html: '<html><body><article><h1>Stats Test 1</h1><p>Content for stats test.</p></article></body></html>', url: 'https://example.com/stats-1' },
        { html: '<html><body><article><h1>Stats Test 2</h1><p>Content for stats test.</p></article></body></html>', url: 'https://example.com/stats-2' }
      ];

      for (const article of articles) {
        await request(app)
          .post('/api/articles')
          .set(createAuthHeaders())
          .send(article);
      }
    });

    it('should return article statistics', async () => {
      const response = await request(app)
        .get('/api/articles/stats')
        .set(createAuthHeaders());

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total_articles');
      expect(response.body).toHaveProperty('archived_articles');
      expect(response.body).toHaveProperty('favorite_articles');
      expect(response.body).toHaveProperty('unread_articles');
      expect(response.body).toHaveProperty('total_words');
      expect(response.body).toHaveProperty('total_reading_time');
    });

    it('should have correct statistics structure', async () => {
      const response = await request(app)
        .get('/api/articles/stats')
        .set(createAuthHeaders());

      expect(typeof response.body.total_articles).toBe('number');
      expect(typeof response.body.archived_articles).toBe('number');
      expect(typeof response.body.favorite_articles).toBe('number');
      expect(typeof response.body.unread_articles).toBe('number');
    });
  });
});
