import { describe, it, expect, afterEach } from '@jest/globals';
import {
  getArticleBodyLimit,
  getMaxArticleBytes,
  getMaxArticleMb,
  validateConfig
} from '../config.js';

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
    // The getter is a safety net for callers that never ran validateConfig;
    // the startup check is what rejects these values outright
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

describe('validateConfig', () => {
  // NODE_ENV is deliberately excluded: Jest sets it and deleting it mid-run
  // could affect later test files in the same worker.
  const MANAGED = [
    'PORT',
    'LOG_LEVEL',
    'DB_PATH',
    'CORS_ORIGIN',
    'IMAGE_QUALITY',
    'IMAGE_TIMEOUT_MS',
    'MAX_IMAGE_SIZE_MB',
    'MAX_ARTICLE_SIZE_MB',
    'API_RATE_LIMIT',
    'SMTP_PORT',
    'SMTP_SECURE'
  ];
  const snapshot = Object.fromEntries(MANAGED.map(key => [key, process.env[key]]));

  const restore = () => {
    for (const key of MANAGED) {
      if (snapshot[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = snapshot[key];
      }
    }
  };

  afterEach(restore);

  const clearAll = () => MANAGED.forEach(key => delete process.env[key]);

  it('should resolve defaults when values are unset', () => {
    clearAll();
    const resolved = validateConfig();

    expect(resolved.PORT).toBe(3000);
    expect(resolved.MAX_ARTICLE_SIZE_MB).toBe(10);
    expect(resolved.IMAGE_QUALITY).toBe(85);
    expect(resolved.SMTP_PORT).toBe(587);
    expect(resolved.SMTP_SECURE).toBe(false);
    expect(resolved.DB_PATH).toBe('./data/bookmark-digest.db');
  });

  it('should coerce valid values', () => {
    process.env.PORT = '4321';
    process.env.SMTP_SECURE = 'true';
    process.env.MAX_ARTICLE_SIZE_MB = '2.5';

    const resolved = validateConfig();

    expect(resolved.PORT).toBe(4321);
    expect(resolved.SMTP_SECURE).toBe(true);
    expect(resolved.MAX_ARTICLE_SIZE_MB).toBe(2.5);
  });

  it('should treat an empty value as unset', () => {
    process.env.PORT = '';
    expect(validateConfig().PORT).toBe(3000);
  });

  it('should accept the current environment', () => {
    expect(() => validateConfig()).not.toThrow();
  });

  it('should reject a non-numeric PORT', () => {
    process.env.PORT = 'abc';
    expect(() => validateConfig()).toThrow(/PORT must be a whole number/);
  });

  it('should reject an out-of-range value', () => {
    process.env.IMAGE_QUALITY = '200';
    expect(() => validateConfig()).toThrow(/IMAGE_QUALITY must be between 1 and 100/);
  });

  it('should reject a non-boolean flag', () => {
    process.env.SMTP_SECURE = 'maybe';
    expect(() => validateConfig()).toThrow(/SMTP_SECURE must be true or false/);
  });

  it('should reject an unknown NODE_ENV without disturbing Jest', () => {
    const original = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'staging';
      expect(() => validateConfig()).toThrow(/NODE_ENV must be one of/);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('should report every problem at once', () => {
    process.env.PORT = 'abc';
    process.env.IMAGE_QUALITY = '200';

    expect(() => validateConfig()).toThrow(/PORT[\s\S]*IMAGE_QUALITY/);
  });
});
