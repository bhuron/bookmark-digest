import { describe, it, expect } from 'vitest';
import { buildArticleFilter, isTrashView, STATUS_OPTIONS } from './articleFilters';

describe('buildArticleFilter', () => {
  it('should be empty for the default view with no search', () => {
    expect(buildArticleFilter({ status: 'all' })).toEqual({});
  });

  it('should include the search term when present', () => {
    expect(buildArticleFilter({ status: 'all' }, 'rust')).toEqual({ search: 'rust' });
  });

  it('should map each status to its filter flag', () => {
    expect(buildArticleFilter({ status: 'archived' })).toEqual({ is_archived: true });
    expect(buildArticleFilter({ status: 'unread' })).toEqual({ is_archived: false });
    expect(buildArticleFilter({ status: 'favorite' })).toEqual({ is_favorite: true });
    expect(buildArticleFilter({ status: 'trashed' })).toEqual({ trashed: true });
  });

  it('should combine a status with a search term', () => {
    expect(buildArticleFilter({ status: 'favorite' }, 'news')).toEqual({
      is_favorite: true,
      search: 'news'
    });
  });

  it('should ignore an unknown status', () => {
    expect(buildArticleFilter({ status: 'nonsense' })).toEqual({});
  });

  it('should treat a missing filters object as the default view', () => {
    expect(buildArticleFilter()).toEqual({});
  });

  it('should expose trashed as a known status', () => {
    expect(STATUS_OPTIONS).toContain('trashed');
  });
});

describe('isTrashView', () => {
  it('should only be true for the trashed status', () => {
    expect(isTrashView('trashed')).toBe(true);
    expect(isTrashView('all')).toBe(false);
    expect(isTrashView('favorite')).toBe(false);
    expect(isTrashView(undefined)).toBe(false);
  });
});
