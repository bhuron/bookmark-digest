import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { restrictFilePermissions } from './utils/filePermissions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, '../../config.json');
const DEFAULT_ENV_FILE = path.join(__dirname, '../../.env');

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
 * Load environment variables from .env file
 */
export function loadEnv() {
  if (fs.existsSync(DEFAULT_ENV_FILE)) {
    // This file holds the SMTP password, so keep it owner-only readable
    restrictFilePermissions(DEFAULT_ENV_FILE);

    const envContent = fs.readFileSync(DEFAULT_ENV_FILE, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key && value && !key.startsWith('#')) {
        process.env[key.trim()] = value;
      }
    });
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
 * Falls back to 10 MB when unset or not a positive number.
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
