/**
 * One canonical article filter, shared by the list request and the bulk
 * operations so the two can never disagree about what "all matching" means.
 *
 * The same object works as query parameters and as a bulk request body: axios
 * serialises booleans to 'true'/'false', which the API accepts in both places.
 */

/** Status values offered by the filter control */
export const STATUS_OPTIONS = ['all', 'unread', 'archived', 'favorite', 'trashed'];

/**
 * Build the filter for a status, sort choice and search term.
 *
 * @param {{status?: string, sortBy?: string}} filters - Current filter controls
 * @param {string} [search] - Search term
 * @returns {{search?: string, is_archived?: boolean, is_favorite?: boolean, trashed?: boolean}}
 */
export function buildArticleFilter({ status = 'all' } = {}, search) {
  const filter = {};

  if (search) {
    filter.search = search;
  }

  if (status === 'archived') {
    filter.is_archived = true;
  } else if (status === 'unread') {
    filter.is_archived = false;
  } else if (status === 'favorite') {
    filter.is_favorite = true;
  } else if (status === 'trashed') {
    filter.trashed = true;
  }

  return filter;
}

/**
 * True when the given status is the trash view rather than the library.
 */
export function isTrashView(status) {
  return status === 'trashed';
}

export default { buildArticleFilter, isTrashView, STATUS_OPTIONS };
