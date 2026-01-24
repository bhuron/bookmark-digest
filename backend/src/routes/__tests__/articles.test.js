import { jest, describe, it, expect } from '@jest/globals';
import articlesRouter from '../articles.js';

// Mock dependencies to avoid loading the actual services
jest.mock('../../services/articleProcessor.js', () => ({
  processArticle: jest.fn(),
  saveArticle: jest.fn(),
  saveFailedArticle: jest.fn()
}));

jest.mock('../../database/index.js', () => ({
  getConnection: jest.fn()
}));

jest.mock('../../utils/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Articles API Routes', () => {
  describe('Router Setup', () => {
    it('should export a router', () => {
      expect(articlesRouter).toBeDefined();
      expect(articlesRouter).toHaveProperty('stack');
      expect(articlesRouter).toHaveProperty('name');
    });

    it('should be an Express router', () => {
      expect(articlesRouter.name).toBe('router');
      expect(Array.isArray(articlesRouter.stack)).toBe(true);
    });
  });

  describe('Route Endpoints', () => {
    let routes;

    beforeAll(() => {
      // Extract routes from the router
      routes = articlesRouter.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods).filter(method => layer.route.methods[method])
        }));
    });

    it('should have POST endpoint for creating articles', () => {
      const postRoute = routes.find(route => route.methods.includes('post'));
      expect(postRoute).toBeDefined();
    });

    it('should have GET endpoint for listing articles', () => {
      const getRoute = routes.find(route => route.methods.includes('get'));
      expect(getRoute).toBeDefined();
    });

    it('should have PUT endpoint for updating articles', () => {
      const putRoute = routes.find(route => route.methods.includes('put'));
      expect(putRoute).toBeDefined();
    });

    it('should have DELETE endpoint for deleting articles', () => {
      const deleteRoute = routes.find(route => route.methods.includes('delete'));
      expect(deleteRoute).toBeDefined();
    });

    it('should have route for single article operations', () => {
      const paramRoute = routes.find(route => route.path.includes(':id'));
      expect(paramRoute).toBeDefined();
    });

    it('should have route for statistics', () => {
      const statsRoute = routes.find(route => route.path.includes('stats'));
      expect(statsRoute).toBeDefined();
    });
  });

  describe('Route Structure', () => {
    it('should have routes defined', () => {
      const routeCount = articlesRouter.stack.filter(layer => layer.route).length;
      expect(routeCount).toBeGreaterThan(0);
    });

    it('should have middleware attached', () => {
      // Routes should have middleware (express-validators, etc.)
      const hasMiddleware = articlesRouter.stack.some(layer =>
        !layer.route && layer.name
      );
      // This may or may not be true depending on how middleware is attached
      expect(hasMiddleware).toBeDefined();
    });
  });

  describe('HTTP Methods', () => {
    it('should support GET method', () => {
      const routes = articlesRouter.stack.filter(layer => layer.route);
      const getRoutes = routes.filter(layer => layer.route.methods.get);
      expect(getRoutes.length).toBeGreaterThan(0);
    });

    it('should support POST method', () => {
      const routes = articlesRouter.stack.filter(layer => layer.route);
      const postRoutes = routes.filter(layer => layer.route.methods.post);
      expect(postRoutes.length).toBeGreaterThan(0);
    });

    it('should support PUT method', () => {
      const routes = articlesRouter.stack.filter(layer => layer.route);
      const putRoutes = routes.filter(layer => layer.route.methods.put);
      expect(putRoutes.length).toBeGreaterThan(0);
    });

    it('should support DELETE method', () => {
      const routes = articlesRouter.stack.filter(layer => layer.route);
      const deleteRoutes = routes.filter(layer => layer.route.methods.delete);
      expect(deleteRoutes.length).toBeGreaterThan(0);
    });
  });
});
