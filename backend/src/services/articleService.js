import { getConnection } from '../database/index.js';
import imageHandler from './imageHandler.js';
import logger from '../utils/logger.js';

/**
 * Accepted `sort_by` values mapped to safe ORDER BY clauses. User input is only
 * ever used to look a clause up here, never interpolated into SQL.
 */
const SORT_CLAUSES = {
  created_at: 'a.created_at DESC',
  created_at_asc: 'a.created_at ASC',
  title: 'a.title ASC',
  title_desc: 'a.title DESC',
  reading_time: 'a.reading_time_minutes ASC'
};

const DEFAULT_SORT = 'created_at';

/**
 * Add the boolean flags the API exposes, since SQLite stores them as integers
 */
function withMetadata(article) {
  return {
    ...article,
    has_images: Boolean(article.has_images),
    is_archived: Boolean(article.is_archived),
    is_favorite: Boolean(article.is_favorite)
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
   * List captured articles with pagination and filters.
   *
   * @param {Object} options
   * @param {number} [options.page=1] - 1-based page number
   * @param {number} [options.limit=20] - Page size
   * @param {string} [options.search] - Substring match on title, text or excerpt
   * @param {string} [options.is_archived] - 'true'/'false' filter
   * @param {string} [options.is_favorite] - 'true'/'false' filter
   * @param {string} [options.sort_by='created_at'] - One of SORT_CLAUSES
   * @returns {{articles: Array, total: number}}
   */
  listArticles({
    page = 1,
    limit = 20,
    search,
    is_archived,
    is_favorite,
    sort_by = DEFAULT_SORT
  } = {}) {
    const db = getConnection();

    const conditions = ['a.capture_success = 1'];
    const params = [];

    if (search) {
      conditions.push('(a.title LIKE ? OR a.content_text LIKE ? OR a.excerpt LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (is_archived !== undefined) {
      conditions.push('a.is_archived = ?');
      params.push(is_archived === 'true' ? 1 : 0);
    }

    if (is_favorite !== undefined) {
      conditions.push('a.is_favorite = ?');
      params.push(is_favorite === 'true' ? 1 : 0);
    }

    const whereClause = conditions.join(' AND ');
    const orderBy = SORT_CLAUSES[sort_by] || SORT_CLAUSES[DEFAULT_SORT];
    const offset = (page - 1) * limit;

    const articles = db.prepare(`
      SELECT a.*
      FROM articles a
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const { total } = db.prepare(`
      SELECT COUNT(*) as total
      FROM articles a
      WHERE ${whereClause}
    `).get(...params);

    return { articles: articles.map(withMetadata), total };
  }

  /**
   * Get a single article by id.
   *
   * @param {number|string} id - Article id
   * @returns {Object|null} - Article, or null when it does not exist
   */
  getArticleById(id) {
    const db = getConnection();
    const article = db.prepare('SELECT a.* FROM articles a WHERE a.id = ?').get(id);

    return article ? withMetadata(article) : null;
  }

  /**
   * Update the editable fields of an article.
   *
   * @param {number|string} id - Article id
   * @param {Object} fields - Any of title, is_archived, is_favorite
   * @returns {{found: boolean, updated: boolean}} - updated is false when no
   *   recognised field was supplied
   */
  updateArticle(id, { title, is_archived, is_favorite } = {}) {
    const db = getConnection();

    const existing = db.prepare('SELECT id FROM articles WHERE id = ?').get(id);

    if (!existing) {
      return { found: false, updated: false };
    }

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

    if (assignments.length === 0) {
      return { found: true, updated: false };
    }

    params.push(id);
    db.prepare(`UPDATE articles SET ${assignments.join(', ')} WHERE id = ?`).run(...params);

    logger.debug('Article updated', { articleId: id, fields: assignments.join(', ') });

    return { found: true, updated: true };
  }

  /**
   * Aggregated statistics across successfully captured articles.
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
      WHERE capture_success = 1
    `).get();

    return {
      total_articles: stats.total_articles || 0,
      archived_articles: stats.archived_articles || 0,
      favorite_articles: stats.favorite_articles || 0,
      unread_articles: stats.unread_articles || 0,
      articles_with_images: stats.articles_with_images || 0,
      total_words: stats.total_words || 0,
      total_reading_time: stats.total_reading_time || 0
    };
  }

  /**
   * Delete articles and remove their image files from disk.
   *
   * Rows are removed in one transaction, so the batch all lands or none of it
   * does. `article_images` rows go with them through ON DELETE CASCADE, so the
   * stored paths are collected first. File cleanup is best-effort: the rows are
   * already gone by then and a failed unlink must not fail the request.
   *
   * @param {number[]} ids - Article ids to delete
   * @returns {Promise<{deleted: number, imagesRemoved: number, imageCount: number}>}
   */
  async deleteArticlesByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { deleted: 0, imagesRemoved: 0, imageCount: 0 };
    }

    const db = getConnection();
    const placeholders = ids.map(() => '?').join(', ');

    const imagePaths = db
      .prepare(`SELECT local_path FROM article_images WHERE article_id IN (${placeholders})`)
      .all(...ids)
      .map(row => row.local_path);

    const deleteStmt = db.prepare(`DELETE FROM articles WHERE id IN (${placeholders})`);
    const deleted = db.transaction(() => deleteStmt.run(...ids).changes)();

    const imagesRemoved = await imageHandler.deleteImageFiles(imagePaths);

    return { deleted, imagesRemoved, imageCount: imagePaths.length };
  }
}

const articleService = new ArticleService();

export default articleService;
