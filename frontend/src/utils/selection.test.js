import { describe, it, expect } from 'vitest';
import {
  isAllSelected,
  isPartiallySelected,
  selectedVisibleIds,
  toggleAll,
  toggleId,
} from './selection';

const articles = [{ id: 1 }, { id: 2 }, { id: 3 }];

describe('toggleId', () => {
  it('adds an id that is not selected', () => {
    expect([...toggleId(new Set(), 2)]).toEqual([2]);
  });

  it('removes an id that is already selected', () => {
    expect([...toggleId(new Set([1, 2]), 2)]).toEqual([1]);
  });

  it('does not mutate the input set', () => {
    const original = new Set([1]);
    toggleId(original, 2);
    expect([...original]).toEqual([1]);
  });
});

describe('toggleAll', () => {
  it('selects every id when none are selected', () => {
    expect([...toggleAll(new Set(), [1, 2])]).toEqual([1, 2]);
  });

  it('clears the selection when every id is already selected', () => {
    expect([...toggleAll(new Set([1, 2]), [1, 2])]).toEqual([]);
  });

  it('fills in the missing ids when only some are selected', () => {
    expect([...toggleAll(new Set([1]), [1, 2])].sort()).toEqual([1, 2]);
  });

  it('does nothing when there are no ids', () => {
    expect([...toggleAll(new Set(), [])]).toEqual([]);
  });
});

describe('selectedVisibleIds', () => {
  it('returns only selected ids that are still visible', () => {
    expect(selectedVisibleIds(articles, new Set([2, 99]))).toEqual([2]);
  });

  it('follows list order rather than selection order', () => {
    expect(selectedVisibleIds(articles, new Set([3, 1]))).toEqual([1, 3]);
  });

  it('returns nothing when the page is empty', () => {
    // Regression guard: after deleting a whole page, stale ids must not be
    // offered up for another delete
    expect(selectedVisibleIds([], new Set([1, 2]))).toEqual([]);
  });
});

describe('isAllSelected / isPartiallySelected', () => {
  it('reports nothing selected', () => {
    expect(isAllSelected(articles, new Set())).toBe(false);
    expect(isPartiallySelected(articles, new Set())).toBe(false);
  });

  it('reports a partial selection', () => {
    expect(isAllSelected(articles, new Set([1]))).toBe(false);
    expect(isPartiallySelected(articles, new Set([1]))).toBe(true);
  });

  it('reports everything selected', () => {
    expect(isAllSelected(articles, new Set([1, 2, 3]))).toBe(true);
    expect(isPartiallySelected(articles, new Set([1, 2, 3]))).toBe(false);
  });

  it('treats an empty list as nothing selected', () => {
    expect(isAllSelected([], new Set([1]))).toBe(false);
    expect(isPartiallySelected([], new Set([1]))).toBe(false);
  });
});
