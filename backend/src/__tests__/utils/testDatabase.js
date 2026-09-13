import fs from 'fs';
import { closeConnection, initializeDatabase } from '../../database/index.js';

// Remembers the state setupTestDatabase replaced, so teardown can restore it
let previousDbPath;
let activeDbPath;

/**
 * Give a unit-test suite its own migrated SQLite database.
 *
 * Integration tests get this via testApp.js, but service unit tests that exercise
 * real SQL used to rely on the developer's own ./data/bookmark-digest.db already
 * existing. On a clean checkout - which is what CI gets - that file is absent and
 * the suite failed with "no such table".
 *
 * Call from beforeAll and pair it with teardownTestDatabase in afterAll. Jest
 * reuses a worker across files, so the previous DB_PATH is restored on teardown
 * and the connection is closed rather than left pointing at a deleted file.
 *
 * @param {string} testId - Unique name for the suite, used in the file name
 * @returns {Promise<string>} - Path of the database that was created
 */
export async function setupTestDatabase(testId) {
  if (!testId || typeof testId !== 'string') {
    throw new Error('setupTestDatabase requires a unique testId');
  }

  previousDbPath = process.env.DB_PATH;
  activeDbPath = `./data/test-unit-${testId}.db`;

  process.env.DB_PATH = activeDbPath;

  // Drop any connection left over from an earlier file in this worker, so the
  // singleton reopens against the database this suite owns
  closeConnection();
  await initializeDatabase();

  return activeDbPath;
}

/**
 * Close the connection, delete the suite's database files and restore DB_PATH.
 *
 * Safe to call even if setup never completed.
 */
export function teardownTestDatabase() {
  try {
    closeConnection();
  } catch {
    // Never opened
  }

  if (activeDbPath) {
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        fs.unlinkSync(`${activeDbPath}${suffix}`);
      } catch {
        // Never created, or already gone
      }
    }
  }

  if (previousDbPath === undefined) {
    delete process.env.DB_PATH;
  } else {
    process.env.DB_PATH = previousDbPath;
  }

  activeDbPath = undefined;
  previousDbPath = undefined;
}
