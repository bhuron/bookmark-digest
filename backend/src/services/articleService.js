import { getConnection } from '../database/index.js';
import imageHandler from './imageHandler.js';
import logger from '../utils/logger.js';

/**
 * Accepted `sort_by` values mapped to safe ORDER BY clauses. User input is only
 * ever used to look a clause up here, never interpolated into SQL.
 */
const SORT_CLAUSES = {
  created_at: 'created_at DESC',
  created_at_asc: 'created_at ASC',
  title: 'title ASC',
  title_desc: 'title DESC',
  reading_time: 'reading_time_minutes ASC'
};

const DEFAULT_SORT = 'created_at';

/**
 * True for the string and boolean spellings of true.
 * Filters arrive as JSON booleans from the API and as strings from the query.
 */
function isTrue(value) {
  return value === true || value === 'true';
}

/**
 * Build a WHERE clause from a filter object.
 *
 * Deliberately refers to unqualified column names so the same clause can be
 * reused by SELECT, UPDATE and DELETE. `trashed` is the only required choice:
 * every caller either lists the library or the trash, never both.
 *
 * @param {Object} [filter]
 * @param {string} [filter.search] - Substring match on title, text or excerpt
 * @param {*} [filter.is_archived] - Restrict to archived/unarchived
 * @param {*} [filter.is_favorite] - Restrict to favourites
 * @param {boolean} [filter.trashed] - True selects trashed rows, otherwise live
 * @returns {{whereClause: string, params: Array}}
 */
function filterScope({ search, is_archived, is_favorite, trashed } = {}) {
  const conditions = ['capture_success = 1'];
  const params = [];

  conditions.push(isTrue(trashed) ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL');

  if (search) {
    conditions.push('(title LIKE ? OR content_text LIKE ? OR excerpt LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (is_archived !== undefined) {
    conditions.push('is_archived = ?');
    params.push(isTrue(is_archived) ? 1 : 0);
  }

  if (is_favorite !== undefined) {
    conditions.push('is_favorite = ?');
    params.push(isTrue(is_favorite) ? 1 : 0);
  }

  return { whereClause: conditions.join(' AND '), params };
}

/**
 * Build a WHERE clause restricting to explicit article ids.
 *
 * @param {number[]} ids - Article ids
 * @param {boolean} live - True requires live rows, false requires trashed rows,
 *   undefined accepts either
 * @returns {{whereClause: string, params: Array}}
 */
function idScope(ids, live) {
  const placeholders = ids.map(() => '?').join(', ');
  const conditions = [`id IN (${placeholders})`];

  if (live === true) {
    conditions.push('deleted_at IS NULL');
  } else if (live === false) {
    conditions.push('deleted_at IS NOT NULL');
  }

  return { whereClause: conditions.join(' AND '), params: [...ids] };
}

/**
 * Resolve a request scope from either explicit ids or a filter.
 *
 * @param {Object} scope
 * @param {number[]} [scope.ids] - Explicit ids, already deduplicated
 * @param {Object} [scope.filter] - Filter object, see filterScope
 * @param {boolean} live - Row state the operation applies to
 */
function resolveScope({ ids, filter }, live) {
  if (Array.isArray(ids) && ids.length > 0) {
    return idScope(ids, live);
  }

  return filterScope({ ...filter, trashed: live === false });
}

/**
 * Add the flags the API exposes, since SQLite stores them as integers
 */
function withMetadata(article) {
  return {
    ...article,
    has_images: Boolean(article.has_images),
    is_archived: Boolean(article.is_archived),
    is_favorite: Boolean(article.is_favorite),
    is_trashed: Boolean(article.deleted_at)
  };
}

/**
 * Reads and writes for stored articles.
 *
 * Keeps SQL out of the HTTP layer so route handlers only deal with requests and
 * responses. Exported as a singleton, matching the other services.
 */
class ArticleService {
  /**
   * List articles with pagination and filters.
   *
   * Trashed articles are excluded unless `trashed` is set, and callers of the
   * trash view get a hint about how many are waiting there.
   *
   * @param {Object} options - See filterScope, plus page/limit/sort_by/trashed
   * @returns {{articles: Array, total: number, trashedTotal: number}}
   */
  listArticles({
    page = 1,
    limit = 20,
    search,
    is_archived,
    is_favorite,
    sort_by = DEFAULT_SORT,
    trashed = false
  } = {}) {
    const db = getConnection();

    const { whereClause, params } = filterScope({ search, is_archived, is_favorite, trashed });
    const orderBy = SORT_CLAUSES[sort_by] || SORT_CLAUSES[DEFAULT_SORT];
    const offset = (page - 1) * limit;

    const articles = db.prepare(`
      SELECT *
      FROM articles
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const { total } = db.prepare(`
      SELECT COUNT(*) as total
      FROM articles
      WHERE ${whereClause}
    `).get(...params);

    // Surfaced so the UI can offer "empty trash" without a second request
    const { trashedTotal } = db.prepare(`
      SELECT COUNT(*) as trashedTotal
      FROM articles
      WHERE capture_success = 1 AND deleted_at IS NOT NULL
    `).get();

    return { articles: articles.map(withMetadata), total, trashedTotal };
  }

  /**
   * Get a single live article by id. Trashed articles are not found.
   *
   * @param {number|string} id - Article id
   * @returns {Object|null} - Article, or null when it does not exist
   */
  getArticleById(id) {
    const db = getConnection();
    const article = db
      .prepare('SELECT * FROM articles WHERE id = ? AND deleted_at IS NULL')
      .get(id);

    return article ? withMetadata(article) : null;
  }

  /**
   * Update the editable fields of a live article.
   *
   * @param {number|string} id - Article id
   * @param {Object} fields - Any of title, is_archived, is_favorite
   * @returns {{found: boolean, updated: boolean}} - updated is false when no
   *   recognised field was supplied
   */
  updateArticle(id, { title, is_archived, is_favorite } = {}) {
    const db = getConnection();

    const existing = db
      .prepare('SELECT id FROM articles WHERE id = ? AND deleted_at IS NULL')
      .get(id);

    if (!existing) {
      return { found: false, updated: false };
    }

    const { assignments, params } = buildFieldAssignments({ title, is_archived, is_favorite });

    if (assignments.length === 0) {
      return { found: true, updated: false };
    }

    params.push(id);
    db.prepare(`UPDATE articles SET ${assignments.join(', ')} WHERE id = ?`).run(...params);

    logger.debug('Article updated', { articleId: id, fields: assignments.join(', ') });

    return { found: true, updated: true };
  }

  /**
   * Apply archive/favourite flags to many articles at once.
   *
   * @param {{ids?: number[], filter?: Object}} scope - Targets to update
   * @param {Object} fields - Any of is_archived, is_favorite
   * @returns {{updated: number}} - Rows changed
   */
  bulkUpdateArticles(scope, { is_archived, is_favorite } = {}) {
    const db = getConnection();
    const { assignments, params } = buildFieldAssignments({ is_archived, is_favorite });

    if (assignments.length === 0) {
      return { updated: 0 };
    }

    const { whereClause, params: scopeParams } = resolveScope(scope, true);
    const result = db
      .prepare(`UPDATE articles SET ${assignments.join(', ')} WHERE ${whereClause}`)
      .run(...params, ...scopeParams);

    logger.debug('Articles bulk updated', {
      fields: assignments.join(', '),
      updated: result.changes
    });

    return { updated: result.changes };
  }

  /**
   * Move articles to the trash.
   *
   * Rows and image files are left in place so the delete can be undone; purging
   * is what actually removes them.
   *
   * @param {{ids?: number[], filter?: Object}} scope - Targets to trash
   * @returns {{deleted: number, requested: number, notFound: number}}
   */
  softDeleteArticles(scope) {
    const db = getConnection();
    const { whereClause, params } = resolveScope(scope, true);

    const result = db
      .prepare('UPDATE articles SET deleted_at = CURRENT_TIMESTAMP WHERE ' + whereClause)
      .run(...params);

    const requested = Array.isArray(scope.ids) && scope.ids.length > 0
      ? scope.ids.length
      : result.changes;

    logger.info('Articles moved to trash', { deleted: result.changes, requested });

    return {
      deleted: result.changes,
      requested,
      notFound: requested - result.changes
    };
  }

  /**
   * Restore articles out of the trash.
   *
   * @param {{ids?: number[], filter?: Object}} scope - Targets to restore
   * @returns {{restored: number}} - Rows changed
   */
  restoreArticles(scope) {
    const db = getConnection();
    const { whereClause, params } = resolveScope(scope, false);

    const result = db
      .prepare('UPDATE articles SET deleted_at = NULL WHERE ' + whereClause)
      .run(...params);

    logger.info('Articles restored from trash', { restored: result.changes });

    return { restored: result.changes };
  }

  /**
   * Permanently delete trashed articles and their image files.
   *
   * Only trashed rows can be purged, so a hard delete always goes through the
   * trash first. Rows are removed in one transaction; `article_images` rows
   * follow through ON DELETE CASCADE, so the stored paths are collected first.
   * File cleanup is best-effort: the rows are already gone by then and a failed
   * unlink must not fail the request.
   *
   * @param {{ids?: number[], filter?: Object}} scope - Targets to purge
   * @returns {Promise<{purged: number, imagesRemoved: number}>}
   */
  async purgeArticles(scope) {
    const db = getConnection();
    const { whereClause, params } = resolveScope(scope, false);

    const targets = db.prepare(`SELECT id FROM articles WHERE ${whereClause}`).all(...params);

    if (targets.length === 0) {
      return { purged: 0, imagesRemoved: 0 };
    }

    const ids = targets.map(row => row.id);
    const placeholders = ids.map(() => '?').join(', ');

    const imagePaths = db
      .prepare(`SELECT local_path FROM article_images WHERE article_id IN (${placeholders})`)
      .all(...ids)
      .map(row => row.local_path);

    const purge = db.transaction(() => db
      .prepare(`DELETE FROM articles WHERE id IN (${placeholders})`)
      .run(...ids).changes);

    const purged = purge();
    const imagesRemoved = await imageHandler.deleteImageFiles(imagePaths);

    logger.info('Articles purged', { purged, imagesRemoved });

    return { purged, imagesRemoved };
  }

  /**
   * Aggregated statistics across live, successfully captured articles.
   *
   * @returns {Object} - Counts and totals, zeroed where SQL returns null
   */
  getStats() {
    const db = getConnection();

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_articles,
        SUM(CASE WHEN is_archived = 1 THEN 1 ELSE 0 END) as archived_articles,
        SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as favorite_articles,
        SUM(CASE WHEN is_archived = 0 THEN 1 ELSE 0 END) as unread_articles,
        SUM(CASE WHEN has_images = 1 THEN 1 ELSE 0 END) as articles_with_images,
        SUM(word_count) as total_words,
        SUM(reading_time_minutes) as total_reading_time
      FROM articles
      WHERE capture_success = 1 AND deleted_at IS NULL
    `).get();

    const { trashed } = db.prepare(`
      SELECT COUNT(*) as trashed
      FROM articles
      WHERE capture_success = 1 AND deleted_at IS NOT NULL
    `).get();

    return {
      total_articles: stats.total_articles || 0,
      archived_articles: stats.archived_articles || 0,
      favorite_articles: stats.favorite_articles || 0,
      unread_articles: stats.unread_articles || 0,
      articles_with_images: stats.articles_with_images || 0,
      total_words: stats.total_words || 0,
      total_reading_time: stats.total_reading_time || 0,
      trashed_articles: trashed || 0
    };
  }
}

/**
 * Build SET assignments for the editable article columns.
 *
 * @param {Object} fields - Any of title, is_archived, is_favorite
 * @returns {{assignments: string[], params: Array}}
 */
function buildFieldAssignments({ title, is_archived, is_favorite } = {}) {
  const assignments = [];
  const params = [];

  if (title !== undefined) {
    assignments.push('title = ?');
    params.push(title);
  }
  if (is_archived !== undefined) {
    assignments.push('is_archived = ?');
    params.push(is_archived ? 1 : 0);
  }
  if (is_favorite !== undefined) {
    assignments.push('is_favorite = ?');
    params.push(is_favorite ? 1 : 0);
  }

  return { assignments, params };
}

const articleService = new ArticleService();

export default articleService;
