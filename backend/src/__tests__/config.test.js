import { describe, it, expect, afterEach } from '@jest/globals';
import { getArticleBodyLimit, getMaxArticleBytes, getMaxArticleMb } from '../config.js';

describe('article size limit configuration', () => {
  const original = process.env.MAX_ARTICLE_SIZE_MB;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.MAX_ARTICLE_SIZE_MB;
    } else {
      process.env.MAX_ARTICLE_SIZE_MB = original;
    }
  });

  it('should default to 10 MB when unset', () => {
    delete process.env.MAX_ARTICLE_SIZE_MB;

    expect(getMaxArticleMb()).toBe(10);
    expect(getMaxArticleBytes()).toBe(10 * 1024 * 1024);
    expect(getArticleBodyLimit()).toBe('10mb');
  });

  it('should honour MAX_ARTICLE_SIZE_MB', () => {
    process.env.MAX_ARTICLE_SIZE_MB = '25';

    expect(getMaxArticleMb()).toBe(25);
    expect(getMaxArticleBytes()).toBe(25 * 1024 * 1024);
    expect(getArticleBodyLimit()).toBe('25mb');
  });

  it('should fall back to 10 MB for invalid values', () => {
    for (const invalid of ['0', '-5', 'abc', '']) {
      process.env.MAX_ARTICLE_SIZE_MB = invalid;
      expect(getMaxArticleMb()).toBe(10);
    }
  });

  it('should keep the body limit and the byte limit consistent', () => {
    process.env.MAX_ARTICLE_SIZE_MB = '3';

    expect(getArticleBodyLimit()).toBe(`${getMaxArticleMb()}mb`);
    expect(getMaxArticleBytes()).toBe(getMaxArticleMb() * 1024 * 1024);
  });
});
