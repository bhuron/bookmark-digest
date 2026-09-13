import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { restrictFilePermissions } from './utils/filePermissions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, '../../config.json');
const DEFAULT_ENV_FILE = path.join(__dirname, '../../.env');

/**
 * Every supported environment variable, its type and its default.
 *
 * Presence is never required: an unset or empty value falls back to the default.
 * A value that is present but invalid is an error (see validateConfig), so a
 * typo surfaces at boot instead of silently becoming a default. SMTP and Kindle
 * settings are deliberately absent from any required list because the feature is
 * optional and normally configured through the UI.
 */
const CONFIG_SCHEMA = {
  PORT: { type: 'int', default: 3000, min: 1, max: 65535 },
  NODE_ENV: { type: 'string', default: 'development', oneOf: ['development', 'production', 'test'] },
  LOG_LEVEL: {
    type: 'string',
    default: 'info',
    oneOf: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']
  },
  DB_PATH: { type: 'string', default: './data/bookmark-digest.db' },
  EPUB_EXPORT_DIR: { type: 'string', default: './epub-exports' },
  MAX_IMAGE_SIZE_MB: { type: 'number', default: 5, min: 0.1, max: 100 },
  IMAGE_QUALITY: { type: 'int', default: 85, min: 1, max: 100 },
  IMAGE_TIMEOUT_MS: { type: 'int', default: 10000, min: 100, max: 600000 },
  MAX_ARTICLE_SIZE_MB: { type: 'number', default: 10, min: 0.1, max: 100 },
  API_RATE_LIMIT: { type: 'int', default: 100, min: 1, max: 1000000 },
  CORS_ORIGIN: { type: 'string', default: 'http://localhost:5174' },
  KINDLE_EMAIL: { type: 'string', default: '' },
  SMTP_HOST: { type: 'string', default: '' },
  SMTP_PORT: { type: 'int', default: 587, min: 1, max: 65535 },
  SMTP_SECURE: { type: 'bool', default: false },
  SMTP_USER: { type: 'string', default: '' },
  SMTP_PASSWORD: { type: 'string', default: '' },
  FROM_EMAIL: { type: 'string', default: '' }
};

/**
 * Coerce and check one raw value against its rule.
 * @returns {{value?: *, error?: string}}
 */
function coerceValue(key, rule, raw) {
  const text = String(raw).trim();

  if (rule.type === 'bool') {
    if (['true', '1', 'yes', 'on'].includes(text.toLowerCase())) return { value: true };
    if (['false', '0', 'no', 'off'].includes(text.toLowerCase())) return { value: false };
    return { error: `${key} must be true or false (got "${text}")` };
  }

  if (rule.type === 'int' || rule.type === 'number') {
    if (rule.type === 'int' && !/^-?\d+$/.test(text)) {
      return { error: `${key} must be a whole number (got "${text}")` };
    }

    const num = Number(text);
    if (!Number.isFinite(num)) {
      return { error: `${key} must be a number (got "${text}")` };
    }
    if (num < rule.min || num > rule.max) {
      return { error: `${key} must be between ${rule.min} and ${rule.max} (got ${num})` };
    }

    return { value: num };
  }

  if (rule.oneOf && !rule.oneOf.includes(text)) {
    return { error: `${key} must be one of ${rule.oneOf.join(', ')} (got "${text}")` };
  }

  return { value: text };
}

/**
 * Check every known environment variable and return the resolved values.
 *
 * Does not touch process.env, so callers that set variables dynamically (tests,
 * for example) keep working. Throws with every problem listed at once rather
 * than failing on the first one.
 *
 * @returns {Object} - Resolved configuration values
 * @throws {Error} - When any value is present but invalid
 */
export function validateConfig() {
  const errors = [];
  const resolved = {};

  for (const [key, rule] of Object.entries(CONFIG_SCHEMA)) {
    const raw = process.env[key];

    if (raw === undefined || String(raw).trim() === '') {
      resolved[key] = rule.default;
      continue;
    }

    const { value, error } = coerceValue(key, rule, raw);

    if (error) {
      errors.push(error);
    } else {
      resolved[key] = value;
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid configuration:\n  - ${errors.join('\n  - ')}`);
  }

  return resolved;
}

/**
 * Ensure configuration exists and load it
 * Generates API key on first run
 */
export function ensureConfig() {
  let config = {};

  // Check if config file exists
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (error) {
      console.error('Failed to parse config.json, creating new config:', error.message);
      config = {};
    }

    // This file holds the API key, so keep it owner-only readable
    restrictFilePermissions(CONFIG_FILE);
  }

  // Generate API key if it doesn't exist
  if (!config.apiKey) {
    config.apiKey = crypto.randomBytes(32).toString('hex');
    config.createdAt = new Date().toISOString();

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    restrictFilePermissions(CONFIG_FILE);

    console.log('\n========================================');
    console.log('  🔑 Generated new API key');
    console.log('========================================');
    console.log(`  API Key: ${config.apiKey}`);
    console.log('\n  Add this key to your:');
    console.log('  - Browser extension settings');
    console.log('  - Frontend configuration');
    console.log('========================================\n');
  }

  return config;
}

/**
 * Load environment variables from the .env file at the repository root.
 *
 * dotenv never overwrites variables that are already set, so the real process
 * environment (a shell export, pm2 `env`, a container) takes precedence over the
 * file. This is the opposite of what a hand-rolled parser usually does, and it is
 * what lets `NODE_ENV=production pm2 start` win over a development value in .env.
 */
export function loadEnv() {
  if (fs.existsSync(DEFAULT_ENV_FILE)) {
    // This file holds the SMTP password, so keep it owner-only readable
    restrictFilePermissions(DEFAULT_ENV_FILE);
    dotenv.config({ path: DEFAULT_ENV_FILE, quiet: true });
  }
}

/**
 * Get configuration value with default
 */
export function getConfig(key, defaultValue = null) {
  return process.env[key] || defaultValue;
}

/**
 * Maximum accepted article HTML size in megabytes (MAX_ARTICLE_SIZE_MB).
 *
 * validateConfig rejects an out-of-range value at boot; this guard only covers
 * callers that never ran it, such as unit tests.
 */
export function getMaxArticleMb() {
  const mb = Number(getConfig('MAX_ARTICLE_SIZE_MB', 10));
  return Number.isFinite(mb) && mb > 0 ? mb : 10;
}

/**
 * Maximum accepted article HTML size in bytes, used by request validation.
 */
export function getMaxArticleBytes() {
  return Math.floor(getMaxArticleMb() * 1024 * 1024);
}

/**
 * Express body-parser limit derived from the same setting, so the parser and
 * the validator can never disagree about the limit.
 */
export function getArticleBodyLimit() {
  return `${getMaxArticleMb()}mb`;
}

/**
 * Generate a new API key (for testing)
 */
export function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Load environment and config on import
loadEnv();
const config = ensureConfig();

export default config;
