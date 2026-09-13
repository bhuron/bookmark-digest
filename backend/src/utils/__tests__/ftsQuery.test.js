import { describe, it, expect } from '@jest/globals';
import { buildMatchExpression } from '../ftsQuery.js';

describe('buildMatchExpression', () => {
  it('should turn a single term into a prefix query', () => {
    expect(buildMatchExpression('rust')).toBe('"rust"*');
  });

  it('should require every term to match', () => {
    // Adjacent quoted phrases are ANDed by FTS5
    expect(buildMatchExpression('rust async')).toBe('"rust"* "async"*');
  });

  it('should collapse surrounding and repeated whitespace', () => {
    expect(buildMatchExpression('  rust   async  ')).toBe('"rust"* "async"*');
  });

  it('should strip quotes so FTS cannot be handed a malformed phrase', () => {
    expect(buildMatchExpression('foo"bar')).toBe('"foobar"*');
    expect(buildMatchExpression('"')).toBeNull();
  });

  it('should strip asterisks so a term cannot inject query syntax', () => {
    expect(buildMatchExpression('ru*st')).toBe('"rust"*');
    expect(buildMatchExpression('*')).toBeNull();
  });

  it('should neutralize FTS operators by quoting them', () => {
    expect(buildMatchExpression('OR')).toBe('"OR"*');
    expect(buildMatchExpression('a OR b')).toBe('"a"* "OR"* "b"*');
    expect(buildMatchExpression('NOT (x)')).toBe('"NOT"* "(x)"*');
  });

  it('should ignore empty and non-string input', () => {
    expect(buildMatchExpression('')).toBeNull();
    expect(buildMatchExpression('   ')).toBeNull();
    expect(buildMatchExpression(undefined)).toBeNull();
    expect(buildMatchExpression(null)).toBeNull();
    expect(buildMatchExpression(42)).toBeNull();
  });
});
