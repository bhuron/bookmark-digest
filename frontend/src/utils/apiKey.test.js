import { describe, it, expect, afterEach } from 'vitest';
import {
  API_KEY_STORAGE_KEY,
  buildApiKeyCookie,
  clearApiKey,
  getApiKey,
  hasApiKey,
  parseApiKeyFromCookie,
  setApiKey,
} from './apiKey';

const hadDocument = 'document' in globalThis;
const hadLocalStorage = 'localStorage' in globalThis;
const realDocument = globalThis.document;
const realLocalStorage = globalThis.localStorage;

/** Minimal browser stand-ins, so the precedence rules can be tested in node */
function fakeBrowser({ cookie = '', stored = null } = {}) {
  const store = new Map();

  if (stored !== null) {
    store.set(API_KEY_STORAGE_KEY, stored);
  }

  let currentCookie = cookie;

  globalThis.document = {
    get cookie() {
      return currentCookie;
    },
    set cookie(value) {
      currentCookie = value;
    },
  };

  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };

  return store;
}

afterEach(() => {
  if (hadDocument) {
    globalThis.document = realDocument;
  } else {
    delete globalThis.document;
  }

  if (hadLocalStorage) {
    globalThis.localStorage = realLocalStorage;
  } else {
    delete globalThis.localStorage;
  }
});

describe('parseApiKeyFromCookie', () => {
  it('should find the key among other cookies', () => {
    expect(parseApiKeyFromCookie(`other=1; ${API_KEY_STORAGE_KEY}=abc123; more=2`)).toBe('abc123');
  });

  it('should return empty when the cookie is absent', () => {
    expect(parseApiKeyFromCookie('other=1')).toBe('');
    expect(parseApiKeyFromCookie('')).toBe('');
    expect(parseApiKeyFromCookie(undefined)).toBe('');
  });

  it('should decode a value that needed encoding', () => {
    expect(parseApiKeyFromCookie(`${API_KEY_STORAGE_KEY}=a%20b`)).toBe('a b');
  });
});

describe('buildApiKeyCookie', () => {
  it('should scope to the host and expire in a year', () => {
    const cookie = buildApiKeyCookie('abc123');

    expect(cookie).toContain(`${API_KEY_STORAGE_KEY}=abc123`);
    expect(cookie).toContain('path=/');
    expect(cookie).toContain('max-age=');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('should encode the value', () => {
    expect(buildApiKeyCookie('a b')).toContain('a%20b');
  });
});

describe('getApiKey', () => {
  it('should prefer the cookie, since that is what both ports share', () => {
    fakeBrowser({ cookie: `${API_KEY_STORAGE_KEY}=from-cookie`, stored: 'from-storage' });

    expect(getApiKey()).toBe('from-cookie');
  });

  it('should fall back to localStorage and migrate it into the cookie', () => {
    fakeBrowser({ stored: 'only-in-storage' });

    expect(getApiKey()).toBe('only-in-storage');
    expect(document.cookie).toContain(`${API_KEY_STORAGE_KEY}=only-in-storage`);
  });

  it('should return empty when nothing is stored', () => {
    fakeBrowser();

    expect(getApiKey()).toBe('');
    expect(hasApiKey()).toBe(false);
  });

  it('should not throw without a browser', () => {
    delete globalThis.document;
    delete globalThis.localStorage;

    expect(getApiKey()).toBe('');
  });
});

describe('setApiKey', () => {
  it('should write both stores and trim the value', () => {
    const store = fakeBrowser();

    expect(setApiKey('  abc123  ')).toBe('abc123');
    expect(store.get(API_KEY_STORAGE_KEY)).toBe('abc123');
    expect(document.cookie).toContain(`${API_KEY_STORAGE_KEY}=abc123`);
    expect(hasApiKey()).toBe(true);
  });
});

describe('clearApiKey', () => {
  it('should remove the key from both stores', () => {
    const store = fakeBrowser({ stored: 'abc123' });

    clearApiKey();

    expect(store.has(API_KEY_STORAGE_KEY)).toBe(false);
    expect(document.cookie).toContain('max-age=0');
  });
});
