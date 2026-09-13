import { describe, it, expect } from '@jest/globals';
import { isSpaRoute } from '../spaRoutes.js';

describe('isSpaRoute', () => {
  it('should accept application routes', () => {
    expect(isSpaRoute('/')).toBe(true);
    expect(isSpaRoute('/articles')).toBe(true);
    expect(isSpaRoute('/articles/42')).toBe(true);
    expect(isSpaRoute('/epub')).toBe(true);
    expect(isSpaRoute('/settings')).toBe(true);
  });

  it('should reject the API, health and image paths', () => {
    expect(isSpaRoute('/api')).toBe(false);
    expect(isSpaRoute('/api/articles')).toBe(false);
    expect(isSpaRoute('/api/does-not-exist')).toBe(false);
    expect(isSpaRoute('/health')).toBe(false);
    expect(isSpaRoute('/images')).toBe(false);
    expect(isSpaRoute('/images/some-article/image-0.jpg')).toBe(false);
  });

  it('should match whole path segments only', () => {
    // Regression guard: a naive startsWith would swallow these as server paths
    expect(isSpaRoute('/apiary')).toBe(true);
    expect(isSpaRoute('/healthcheck')).toBe(true);
    expect(isSpaRoute('/images-old')).toBe(true);
  });

  it('should reject malformed input', () => {
    expect(isSpaRoute('')).toBe(false);
    expect(isSpaRoute(undefined)).toBe(false);
    expect(isSpaRoute(null)).toBe(false);
    expect(isSpaRoute('/articles\0')).toBe(false);
  });
});
