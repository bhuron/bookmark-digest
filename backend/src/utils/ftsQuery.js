/**
 * Turn free-text user input into a safe FTS5 MATCH expression.
 *
 * FTS5 has its own query language, and passing raw input straight to MATCH makes
 * the whole statement fail with `fts5: syntax error` for things as ordinary as a
 * stray double quote or a lone operator. Every term is therefore quoted, which
 * makes FTS keywords and punctuation literal text instead of syntax.
 *
 * `"` and `*` are removed rather than escaped: inside a quoted phrase a doubled
 * quote is awkward to get right across SQLite versions, and neither character
 * carries meaning worth preserving in a search box.
 *
 * Each surviving term becomes a prefix query, so searching for "rust" also finds
 * "rustacean" and results update sensibly as the user types.
 *
 * @param {string} search - Raw user input
 * @returns {string|null} - MATCH expression, or null when there is nothing usable
 *   to search for (callers should then treat the search as absent)
 */
export function buildMatchExpression(search) {
  if (typeof search !== 'string') {
    return null;
  }

  const terms = search
    .split(/\s+/)
    .map(term => term.replace(/["*]/g, ''))
    .filter(term => term.length > 0);

  if (terms.length === 0) {
    return null;
  }

  return terms.map(term => `"${term}"*`).join(' ');
}

export default { buildMatchExpression };
