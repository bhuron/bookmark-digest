import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  }

  // Generate API key if it doesn't exist
  if (!config.apiKey) {
    config.apiKey = crypto.randomBytes(32).toString('hex');
    config.createdAt = new Date().toISOString();

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

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
 * Generate a new API key (for testing)
 */
export function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Load environment and config on import
loadEnv();
const config = ensureConfig();

export default config;
