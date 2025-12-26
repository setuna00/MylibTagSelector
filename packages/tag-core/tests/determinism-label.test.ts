/**
 * TagSelector Core - Determinism Label Tests
 * Version: 1.3.1
 *
 * Tests for UTF-16 code unit lexicographic ordering.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTaxonomyIndex,
  computeExportSet,
  sortByUserOrder,
  formatForMylio,
  compareStringsUTF16,
} from '../src/index.js';
import type { Taxonomy } from '../src/index.js';

// Determinism label test data from determinism-label.json
const determinismTaxonomy: Taxonomy = {
  schemaVersion: '1.3.1',
  meta: { name: 'Determinism Label Test' },
  nodes: [
    { id: 'n1', label: 'apple', parentId: null, kind: 'tag', order: 0 },
    { id: 'n2', label: 'Apple', parentId: null, kind: 'tag', order: 0 },
    { id: 'n3', label: 'APPLE', parentId: null, kind: 'tag', order: 0 },
    { id: 'n4', label: '中文', parentId: null, kind: 'tag', order: 0 },
    { id: 'n5', label: '日本語', parentId: null, kind: 'tag', order: 0 },
    { id: 'n6', label: '123', parentId: null, kind: 'tag', order: 0 },
    { id: 'n7', label: '12', parentId: null, kind: 'tag', order: 0 },
    { id: 'n8', label: '1A', parentId: null, kind: 'tag', order: 0 },
  ],
};

describe('UTF-16 Code Unit String Comparison', () => {
  it('should compare strings correctly using UTF-16 code units', () => {
    // Numbers come before uppercase letters
    expect(compareStringsUTF16('12', '123')).toBeLessThan(0); // prefix
    expect(compareStringsUTF16('123', '1A')).toBeLessThan(0); // '2' < 'A'
    expect(compareStringsUTF16('1A', 'APPLE')).toBeLessThan(0); // '1' < 'A'

    // Uppercase comes before lowercase
    expect(compareStringsUTF16('APPLE', 'Apple')).toBeLessThan(0); // 'P' < 'p'
    expect(compareStringsUTF16('Apple', 'apple')).toBeLessThan(0); // 'A' < 'a'

    // ASCII comes before CJK
    expect(compareStringsUTF16('apple', '中文')).toBeLessThan(0);
    expect(compareStringsUTF16('中文', '日本語')).toBeLessThan(0);
  });

  it('should demonstrate that lexicographic is NOT natural sort', () => {
    // "A10" comes BEFORE "A2" in lexicographic order
    // because '0' (48) < '2' (50)
    expect(compareStringsUTF16('A1', 'A10')).toBeLessThan(0); // prefix
    expect(compareStringsUTF16('A10', 'A2')).toBeLessThan(0); // '0' < '2'

    // Full ordering: A1 < A10 < A2
    const labels = ['A2', 'A10', 'A1'];
    labels.sort(compareStringsUTF16);
    expect(labels).toEqual(['A1', 'A10', 'A2']);
  });
});

describe('Determinism Label Sorting', () => {
  const index = buildTaxonomyIndex(determinismTaxonomy);

  it('should sort nodes by UTF-16 code unit order', () => {
    const rootChildren = index.childrenOf.get(null);
    expect(rootChildren).toBeDefined();

    // Expected order by UTF-16 code unit:
    // 12 < 123 < 1A < APPLE < Apple < apple < 中文 < 日本語
    // IDs: n7, n6, n8, n3, n2, n1, n4, n5
    expect(rootChildren).toEqual(['n7', 'n6', 'n8', 'n3', 'n2', 'n1', 'n4', 'n5']);
  });

  it('should assign correct ordinals', () => {
    expect(index.siblingOrdinal.get('n7')).toBe(0); // 12
    expect(index.siblingOrdinal.get('n6')).toBe(1); // 123
    expect(index.siblingOrdinal.get('n8')).toBe(2); // 1A
    expect(index.siblingOrdinal.get('n3')).toBe(3); // APPLE
    expect(index.siblingOrdinal.get('n2')).toBe(4); // Apple
    expect(index.siblingOrdinal.get('n1')).toBe(5); // apple
    expect(index.siblingOrdinal.get('n4')).toBe(6); // 中文
    expect(index.siblingOrdinal.get('n5')).toBe(7); // 日本語
  });

  it('should produce deterministic output when all selected', () => {
    const allIds = new Set(['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8']);
    const exportSet = computeExportSet(index, allIds);
    const sortedIds = sortByUserOrder(index, exportSet);
    const output = formatForMylio(index, sortedIds);

    // Expected: 12, 123, 1A, APPLE, Apple, apple, 中文, 日本語
    expect(output).toBe('12, 123, 1A, APPLE, Apple, apple, 中文, 日本語');
  });

  it('should produce same output on multiple runs', () => {
    const allIds = new Set(['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8']);

    // Run multiple times
    const outputs: string[] = [];
    for (let i = 0; i < 5; i++) {
      const exportSet = computeExportSet(index, allIds);
      const sortedIds = sortByUserOrder(index, exportSet);
      outputs.push(formatForMylio(index, sortedIds));
    }

    // All outputs should be identical
    expect(new Set(outputs).size).toBe(1);
    expect(outputs[0]).toBe('12, 123, 1A, APPLE, Apple, apple, 中文, 日本語');
  });
});

describe('Edge cases for determinism', () => {
  it('should handle empty string label', () => {
    const taxonomy: Taxonomy = {
      schemaVersion: '1.3.1',
      nodes: [
        { id: 'a', label: 'A', parentId: null, kind: 'tag', order: 0 },
        { id: 'empty', label: '', parentId: null, kind: 'tag', order: 0 },
      ],
    };

    const index = buildTaxonomyIndex(taxonomy);
    const rootChildren = index.childrenOf.get(null);

    // Empty string comes before 'A'
    expect(rootChildren).toEqual(['empty', 'a']);
  });

  it('should handle single character labels', () => {
    const taxonomy: Taxonomy = {
      schemaVersion: '1.3.1',
      nodes: [
        { id: 'lower-a', label: 'a', parentId: null, kind: 'tag', order: 0 },
        { id: 'upper-a', label: 'A', parentId: null, kind: 'tag', order: 0 },
        { id: 'digit-1', label: '1', parentId: null, kind: 'tag', order: 0 },
      ],
    };

    const index = buildTaxonomyIndex(taxonomy);
    const rootChildren = index.childrenOf.get(null);

    // '1' (49) < 'A' (65) < 'a' (97)
    expect(rootChildren).toEqual(['digit-1', 'upper-a', 'lower-a']);
  });

  it('should handle unicode characters correctly', () => {
    const taxonomy: Taxonomy = {
      schemaVersion: '1.3.1',
      nodes: [
        { id: 'hiragana', label: 'あ', parentId: null, kind: 'tag', order: 0 },
        { id: 'katakana', label: 'ア', parentId: null, kind: 'tag', order: 0 },
        { id: 'kanji', label: '亜', parentId: null, kind: 'tag', order: 0 },
      ],
    };

    const index = buildTaxonomyIndex(taxonomy);
    const rootChildren = index.childrenOf.get(null);

    // By Unicode code point: ア (U+30A2) < あ (U+3042) < 亜 (U+4E9C)
    // Note: Katakana U+30A2 = 12450, Hiragana U+3042 = 12354
    // Actually: あ (12354) < ア (12450) < 亜 (20124)
    expect(rootChildren).toEqual(['hiragana', 'katakana', 'kanji']);
  });
});

