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
import fs from 'fs/promises';
import path from 'path';
import imageHandler from '../../services/imageHandler.js';
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

    it('should keep image files when trashing and remove them only on purge', async () => {
      const { getConnection } = await import('../../database/index.js');
      const db = getConnection();

      const dirName = `__test-integration-${process.pid}`;
      const dir = path.join(path.resolve(imageHandler.baseImagesDir), dirName);
      const file = path.join(dir, 'image-0.jpg');

      try {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(file, 'data');

        db.prepare(
          'INSERT INTO article_images (article_id, original_url, local_path) VALUES (?, ?, ?)'
        ).run(articleId, 'https://example.com/a.jpg', `/images/${dirName}/image-0.jpg`);

        // Trashing is reversible, so the file has to survive it
        const trashResponse = await request(app)
          .delete(`/api/articles/${articleId}`)
          .set(createAuthHeaders());

        expect(trashResponse.status).toBe(200);
        await expect(fs.access(file)).resolves.toBeUndefined();

        // Purging is permanent, so that is where the file goes
        const purgeResponse = await request(app)
          .delete('/api/articles/purge')
          .set(createAuthHeaders())
          .send({ ids: [articleId] });

        expect(purgeResponse.status).toBe(200);
        expect(purgeResponse.body).toHaveProperty('imagesRemoved', 1);
        await expect(fs.access(file)).rejects.toThrow();
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    it('should return 404 for non-existent article', async () => {
      const response = await request(app)
        .delete('/api/articles/999999')
        .set(createAuthHeaders());

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/articles/bulk', () => {
    const seedArticles = async (count) => {
      const ids = [];

      for (let n = 1; n <= count; n += 1) {
        const response = await request(app)
          .post('/api/articles')
          .set(createAuthHeaders())
          .send({
            html: `<html><body><article><h1>Bulk Delete ${n}</h1><p>Content for bulk delete test number ${n} with sufficient text.</p></article></body></html>`,
            url: `https://example.com/bulk-delete-${n}`
          });

        ids.push(response.body.article.id);
      }

      return ids;
    };

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/articles/bulk')
        .send({ ids: [1, 2] });

      expect(response.status).toBe(401);
    });

    it('should delete multiple articles and leave the rest untouched', async () => {
      const ids = await seedArticles(3);

      const response = await request(app)
        .delete('/api/articles/bulk')
        .set(createAuthHeaders())
        .send({ ids: [ids[0], ids[1]] });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        requested: 2,
        deleted: 2,
        notFound: 0
      });

      const remaining = await request(app)
        .get('/api/articles')
        .set(createAuthHeaders());

      expect(remaining.body.data.total).toBe(1);
      expect(remaining.body.data.articles[0].id).toBe(ids[2]);
    });

    it('should report non-existent IDs without failing the request', async () => {
      const ids = await seedArticles(1);

      const response = await request(app)
        .delete('/api/articles/bulk')
        .set(createAuthHeaders())
        .send({ ids: [ids[0], 999999] });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        requested: 2,
        deleted: 1,
        notFound: 1
      });
    });

    it('should ignore duplicate IDs', async () => {
      const ids = await seedArticles(1);

      const response = await request(app)
        .delete('/api/articles/bulk')
        .set(createAuthHeaders())
        .send({ ids: [ids[0], ids[0], ids[0]] });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ requested: 1, deleted: 1 });
    });

    it('should not be shadowed by the /:id route', async () => {
      // Regression guard: /bulk must reach the bulk handler instead of being
      // parsed as an article ID (which would fail ID validation with a 400)
      const ids = await seedArticles(1);

      const response = await request(app)
        .delete('/api/articles/bulk')
        .set(createAuthHeaders())
        .send({ ids });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('deleted', 1);
    });

    it('should reject an empty ids array', async () => {
      const response = await request(app)
        .delete('/api/articles/bulk')
        .set(createAuthHeaders())
        .send({ ids: [] });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject a non-array ids payload', async () => {
      const response = await request(app)
        .delete('/api/articles/bulk')
        .set(createAuthHeaders())
        .send({ ids: 5 });

      expect(response.status).toBe(400);
    });

    it('should reject non-integer ids', async () => {
      const response = await request(app)
        .delete('/api/articles/bulk')
        .set(createAuthHeaders())
        .send({ ids: ['abc', 2] });

      expect(response.status).toBe(400);
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

  describe('Soft delete and bulk operations', () => {
    const seed = async (count, prefix) => {
      const ids = [];

      for (let n = 1; n <= count; n += 1) {
        const response = await request(app)
          .post('/api/articles')
          .set(createAuthHeaders())
          .send({
            html: `<html><head><title>${prefix} ${n}</title></head><body><article><h1>${prefix} ${n}</h1><p>Body text for the ${prefix} article number ${n}, long enough for extraction.</p></article></body></html>`,
            url: `https://example.com/${prefix}-${n}`
          });

        ids.push(response.body.article.id);
      }

      return ids;
    };

    describe('trash, restore and purge', () => {
      it('should hide a trashed article from the library and from GET', async () => {
        const [id] = await seed(1, 'trash');

        const trash = await request(app)
          .delete(`/api/articles/${id}`)
          .set(createAuthHeaders());

        expect(trash.status).toBe(200);
        expect(trash.body).toHaveProperty('success', true);

        const list = await request(app).get('/api/articles').set(createAuthHeaders());
        expect(list.body.data.total).toBe(0);

        const single = await request(app).get(`/api/articles/${id}`).set(createAuthHeaders());
        expect(single.status).toBe(404);
      });

      it('should list trashed articles when trashed=true', async () => {
        const [id] = await seed(1, 'trashlist');
        await request(app).delete(`/api/articles/${id}`).set(createAuthHeaders());

        const trashed = await request(app)
          .get('/api/articles?trashed=true')
          .set(createAuthHeaders());

        expect(trashed.status).toBe(200);
        expect(trashed.body.data.total).toBe(1);
        expect(trashed.body.data.articles[0]).toMatchObject({ id, is_trashed: true });
      });

      it('should report the trash size alongside the library listing', async () => {
        const ids = await seed(2, 'trashcount');
        await request(app).delete(`/api/articles/${ids[0]}`).set(createAuthHeaders());

        const list = await request(app).get('/api/articles').set(createAuthHeaders());

        expect(list.body.data.total).toBe(1);
        expect(list.body.data.trashedTotal).toBe(1);
      });

      it('should restore a trashed article', async () => {
        const [id] = await seed(1, 'restore');
        await request(app).delete(`/api/articles/${id}`).set(createAuthHeaders());

        const restore = await request(app)
          .post('/api/articles/restore')
          .set(createAuthHeaders())
          .send({ ids: [id] });

        expect(restore.status).toBe(200);
        expect(restore.body).toHaveProperty('restored', 1);

        const single = await request(app).get(`/api/articles/${id}`).set(createAuthHeaders());
        expect(single.status).toBe(200);
        expect(single.body.article.is_trashed).toBe(false);
      });

      it('should not restore an article that is not trashed', async () => {
        const [id] = await seed(1, 'restorelive');

        const restore = await request(app)
          .post('/api/articles/restore')
          .set(createAuthHeaders())
          .send({ ids: [id] });

        expect(restore.body).toHaveProperty('restored', 0);
      });

      it('should refuse to update a trashed article', async () => {
        const [id] = await seed(1, 'trashupdate');
        await request(app).delete(`/api/articles/${id}`).set(createAuthHeaders());

        const update = await request(app)
          .put(`/api/articles/${id}`)
          .set(createAuthHeaders())
          .send({ title: 'Should not apply' });

        expect(update.status).toBe(404);
      });

      it('should count trashed articles in stats separately from the library', async () => {
        const ids = await seed(2, 'trashstats');
        await request(app).delete(`/api/articles/${ids[0]}`).set(createAuthHeaders());

        const stats = await request(app).get('/api/articles/stats').set(createAuthHeaders());

        expect(stats.body.total_articles).toBe(1);
        expect(stats.body.trashed_articles).toBe(1);
      });

      it('should only purge articles that are already trashed', async () => {
        const ids = await seed(2, 'purge');
        await request(app).delete(`/api/articles/${ids[0]}`).set(createAuthHeaders());

        // A live article must survive a purge request
        const livePurge = await request(app)
          .delete('/api/articles/purge')
          .set(createAuthHeaders())
          .send({ ids: [ids[1]] });

        expect(livePurge.body).toHaveProperty('purged', 0);

        const afterLive = await request(app).get('/api/articles').set(createAuthHeaders());
        expect(afterLive.body.data.total).toBe(1);

        // The trashed one goes for good
        const purge = await request(app)
          .delete('/api/articles/purge')
          .set(createAuthHeaders())
          .send({ ids: [ids[0]] });

        expect(purge.body).toHaveProperty('purged', 1);

        const trashed = await request(app)
          .get('/api/articles?trashed=true')
          .set(createAuthHeaders());
        expect(trashed.body.data.total).toBe(0);
      });

      it('should revive a trashed article when the same URL is captured again', async () => {
        const [id] = await seed(1, 'revive');
        await request(app).delete(`/api/articles/${id}`).set(createAuthHeaders());

        const recapture = await request(app)
          .post('/api/articles')
          .set(createAuthHeaders())
          .send({
            html: '<html><head><title>revive 1</title></head><body><article><h1>revive 1</h1><p>Body text for the recaptured article, long enough for extraction to succeed.</p></article></body></html>',
            url: 'https://example.com/revive-1'
          });

        expect(recapture.status).toBe(201);
        expect(recapture.body.article.id).toBe(id);

        const single = await request(app).get(`/api/articles/${id}`).set(createAuthHeaders());
        expect(single.status).toBe(200);
        expect(single.body.article.is_trashed).toBe(false);
      });

      it('should require ids or filter', async () => {
        const response = await request(app)
          .delete('/api/articles/bulk')
          .set(createAuthHeaders())
          .send({});

        expect(response.status).toBe(400);
      });

      it('should reject supplying both ids and filter', async () => {
        const [id] = await seed(1, 'both');

        const response = await request(app)
          .delete('/api/articles/bulk')
          .set(createAuthHeaders())
          .send({ ids: [id], filter: { search: 'both' } });

        expect(response.status).toBe(400);
      });
    });

    describe('bulk operations by filter (cross-page selection)', () => {
      it('should archive every article matching a filter, ignoring pagination', async () => {
        await seed(3, 'archive');

        const response = await request(app)
          .put('/api/articles/bulk')
          .set(createAuthHeaders())
          .send({ filter: {}, is_archived: true });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('updated', 3);

        const archived = await request(app)
          .get('/api/articles?is_archived=true')
          .set(createAuthHeaders());
        expect(archived.body.data.total).toBe(3);
      });

      it('should scope a filter to the current search', async () => {
        await seed(2, 'keep');
        await seed(1, 'needle');

        const response = await request(app)
          .put('/api/articles/bulk')
          .set(createAuthHeaders())
          .send({ filter: { search: 'needle' }, is_favorite: true });

        expect(response.body).toHaveProperty('updated', 1);

        const favorites = await request(app)
          .get('/api/articles?is_favorite=true')
          .set(createAuthHeaders());
        expect(favorites.body.data.total).toBe(1);
      });

      it('should require a field to update', async () => {
        await seed(1, 'nofields');

        const response = await request(app)
          .put('/api/articles/bulk')
          .set(createAuthHeaders())
          .send({ filter: {} });

        expect(response.status).toBe(400);
      });

      it('should trash every article matching a filter', async () => {
        await seed(3, 'bulkdel');

        const response = await request(app)
          .delete('/api/articles/bulk')
          .set(createAuthHeaders())
          .send({ filter: {} });

        expect(response.body).toHaveProperty('deleted', 3);

        const list = await request(app).get('/api/articles').set(createAuthHeaders());
        expect(list.body.data.total).toBe(0);

        const trashed = await request(app)
          .get('/api/articles?trashed=true')
          .set(createAuthHeaders());
        expect(trashed.body.data.total).toBe(3);
      });

      it('should restore every article matching a filter', async () => {
        await seed(2, 'restoreall');
        await request(app)
          .delete('/api/articles/bulk')
          .set(createAuthHeaders())
          .send({ filter: {} });

        const response = await request(app)
          .post('/api/articles/restore')
          .set(createAuthHeaders())
          .send({ filter: {} });

        expect(response.body).toHaveProperty('restored', 2);
      });

      it('should empty the trash with a trashed filter', async () => {
        await seed(2, 'empty');
        await request(app)
          .delete('/api/articles/bulk')
          .set(createAuthHeaders())
          .send({ filter: {} });

        const response = await request(app)
          .delete('/api/articles/purge')
          .set(createAuthHeaders())
          .send({ filter: { trashed: true } });

        expect(response.body).toHaveProperty('purged', 2);

        const trashed = await request(app)
          .get('/api/articles?trashed=true')
          .set(createAuthHeaders());
        expect(trashed.body.data.total).toBe(0);
      });

      it('should reject a filter with an invalid field type', async () => {
        const response = await request(app)
          .delete('/api/articles/bulk')
          .set(createAuthHeaders())
          .send({ filter: { is_archived: 'yes' } });

        expect(response.status).toBe(400);
      });
    });
  });
});
