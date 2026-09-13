/**
 * Selection helpers for the article list.
 *
 * Selection is held as a Set of article IDs and is always resolved against the
 * articles currently on screen, so a stale ID (for example one left over after
 * a page change or a deletion) can never reach the API.
 */

/**
 * Toggle one id.
 * @param {Set<number>} selectedIds - Current selection
 * @param {number} id - Article id to toggle
 * @returns {Set<number>} - New selection (the input is not mutated)
 */
export function toggleId(selectedIds, id) {
  const next = new Set(selectedIds);

  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  return next;
}

/**
 * Select every id, or clear the selection when they are all already selected.
 * @param {Set<number>} selectedIds - Current selection
 * @param {number[]} ids - Ids currently on screen
 * @returns {Set<number>} - New selection
 */
export function toggleAll(selectedIds, ids) {
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
  return allSelected ? new Set() : new Set(ids);
}

/**
 * Selected ids that are still present in the visible list, in list order.
 * @param {Array<{id: number}>} articles - Articles currently on screen
 * @param {Set<number>} selectedIds - Current selection
 * @returns {number[]} - Ids safe to act on
 */
export function selectedVisibleIds(articles, selectedIds) {
  return articles
    .filter((article) => selectedIds.has(article.id))
    .map((article) => article.id);
}

/**
 * True when every visible article is selected and there is at least one.
 */
export function isAllSelected(articles, selectedIds) {
  return articles.length > 0 && selectedIds !== undefined &&
    articles.every((article) => selectedIds.has(article.id));
}

/**
 * True when some, but not all, visible articles are selected.
 */
export function isPartiallySelected(articles, selectedIds) {
  const count = selectedVisibleIds(articles, selectedIds).length;
  return count > 0 && count < articles.length;
}

/**
 * Build the target scope sent to the bulk endpoints.
 *
 * In 'all' mode the server selects the matching set itself, which is what makes
 * "select all matching" work across pages without shipping thousands of ids.
 *
 * @param {Object} options
 * @param {'page'|'all'} options.mode - Whether the whole matching set is targeted
 * @param {Array<{id: number}>} options.articles - Articles on the current page
 * @param {Set<number>} options.selectedIds - Current selection
 * @param {Object} options.filter - Filter describing the matching set
 * @returns {{ids?: number[], filter?: Object}}
 */
export function buildScope({ mode, articles, selectedIds, filter }) {
  if (mode === 'all') {
    return { filter };
  }

  return { ids: selectedVisibleIds(articles, selectedIds) };
}

/**
 * True when every article on the page is selected and more pages exist, which is
 * the only situation where offering "select all matching" makes sense.
 */
export function canSelectAllMatching(articles, selectedIds, total) {
  return articles.length > 0 &&
    selectedIds !== undefined &&
    total > articles.length &&
    isAllSelected(articles, selectedIds);
}
