#!/usr/bin/env node

import { runMigrations, getMigrationStatus } from './migrations.js';
import logger from '../utils/logger.js';

console.log('\n========================================');
console.log('  📦 Bookmark Digest - Database Migrations');
console.log('========================================\n');

try {
  // Run migrations
  runMigrations();

  // Get status
  const status = getMigrationStatus();

  console.log('\n========================================');
  console.log('  ✅ Migrations completed successfully');
  console.log('========================================');
  console.log(`  Total migrations applied: ${status.total}`);
  console.log('========================================\n');

  process.exit(0);
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  logger.error('Migration failed', { error: error.message, stack: error.stack });
  process.exit(1);
}
