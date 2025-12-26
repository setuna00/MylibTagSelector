/**
 * TagSelector Core - Order Collision Tests
 * Version: 1.3.1
 *
 * Tests for handling nodes with the same order value.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTaxonomyIndex,
  computeExportSet,
  sortByUserOrder,
  formatForMylio,
} from '../src/index.js';
import type { Taxonomy } from '../src/index.js';

// Order collision test data from order-collision.json
const orderCollisionTaxonomy: Taxonomy = {
  schemaVersion: '1.3.1',
  meta: { name: 'Order Collision Test' },
  nodes: [
    { id: 'group-a', label: 'GroupA', parentId: null, kind: 'folder', order: 0 },
    { id: 'a1', label: 'A1', parentId: 'group-a', kind: 'tag', order: 0 },
    { id: 'a2', label: 'A2', parentId: 'group-a', kind: 'tag', order: 1 },
    { id: 'group-b', label: 'GroupB', parentId: null, kind: 'folder', order: 0 },
    { id: 'b1', label: 'B1', parentId: 'group-b', kind: 'tag', order: 0 },
    { id: 'b2', label: 'B2', parentId: 'group-b', kind: 'tag', order: 1 },

    { id: 'root', label: 'Root', parentId: null, kind: 'folder', order: 1 },
    { id: 'c1', label: 'C1', parentId: 'root', kind: 'folder', order: 0 },
    { id: 'c1-t', label: 'T1', parentId: 'c1', kind: 'tag', order: 0 },
    { id: 'c2', label: 'C2', parentId: 'root', kind: 'folder', order: 0 },
    { id: 'c2-t', label: 'T2', parentId: 'c2', kind: 'tag', order: 0 },
  ],
};

describe('Order Collision - Case A: Root nodes with same order', () => {
  const index = buildTaxonomyIndex(orderCollisionTaxonomy);

  it('should sort root nodes by label when order is equal', () => {
    // GroupA and GroupB both have order: 0
    // By UTF-16 code unit: 'GroupA' < 'GroupB' (since 'A' < 'B')
    const rootChildren = index.childrenOf.get(null);
    expect(rootChildren).toBeDefined();

    // Should be: group-a, group-b, root
    expect(rootChildren![0]).toBe('group-a');
    expect(rootChildren![1]).toBe('group-b');
    expect(rootChildren![2]).toBe('root');
  });

  it('should assign correct ordinals to root nodes', () => {
    expect(index.siblingOrdinal.get('group-a')).toBe(0);
    expect(index.siblingOrdinal.get('group-b')).toBe(1);
    expect(index.siblingOrdinal.get('root')).toBe(2);
  });

  it('should NOT interleave descendants when exporting', () => {
    // Select: A1, A2, B1, B2
    const selectedIds = new Set(['a1', 'a2', 'b1', 'b2']);
    const exportSet = computeExportSet(index, selectedIds);

    // All should be in export set (all are tags)
    expect(exportSet.has('a1')).toBe(true);
    expect(exportSet.has('a2')).toBe(true);
    expect(exportSet.has('b1')).toBe(true);
    expect(exportSet.has('b2')).toBe(true);

    // Folders should not be in export set
    expect(exportSet.has('group-a')).toBe(false);
    expect(exportSet.has('group-b')).toBe(false);

    const sortedIds = sortByUserOrder(index, exportSet);
    const output = formatForMylio(index, sortedIds);

    // Expected: A1, A2, B1, B2 (NOT interleaved like A1, B1, A2, B2)
    expect(output).toBe('A1, A2, B1, B2');
  });

  it('should verify sortPaths prevent interleaving', () => {
    // A1 and A2 should have sortPaths starting with 0 (group-a.ordinal)
    // B1 and B2 should have sortPaths starting with 1 (group-b.ordinal)
    expect(index.sortPathCache.get('a1')).toEqual([0, 0]);
    expect(index.sortPathCache.get('a2')).toEqual([0, 1]);
    expect(index.sortPathCache.get('b1')).toEqual([1, 0]);
    expect(index.sortPathCache.get('b2')).toEqual([1, 1]);
  });
});

describe('Order Collision - Case B: Deep nodes with same order', () => {
  const index = buildTaxonomyIndex(orderCollisionTaxonomy);

  it('should sort C1 and C2 by label when order is equal', () => {
    // C1 and C2 both have order: 0 under 'root'
    // By UTF-16 code unit: 'C1' < 'C2' (since '1' < '2')
    const rootChildren = index.childrenOf.get('root');
    expect(rootChildren).toBeDefined();

    expect(rootChildren![0]).toBe('c1');
    expect(rootChildren![1]).toBe('c2');
  });

  it('should NOT interleave T1 and T2', () => {
    // Select: T1, T2
    const selectedIds = new Set(['c1-t', 'c2-t']);
    const exportSet = computeExportSet(index, selectedIds);

    expect(exportSet.has('c1-t')).toBe(true);
    expect(exportSet.has('c2-t')).toBe(true);

    const sortedIds = sortByUserOrder(index, exportSet);
    const output = formatForMylio(index, sortedIds);

    // Expected: T1, T2 (C1's descendant before C2's descendant)
    expect(output).toBe('T1, T2');
  });

  it('should have correct sortPaths for T1 and T2', () => {
    // root.ordinal = 2, c1.ordinal = 0, c2.ordinal = 1
    expect(index.sortPathCache.get('c1-t')).toEqual([2, 0, 0]);
    expect(index.sortPathCache.get('c2-t')).toEqual([2, 1, 0]);
  });
});

describe('Order Collision - Edge cases', () => {
  it('should handle all nodes with same order', () => {
    const taxonomy: Taxonomy = {
      schemaVersion: '1.3.1',
      nodes: [
        { id: 'z', label: 'Z', parentId: null, kind: 'tag', order: 0 },
        { id: 'a', label: 'A', parentId: null, kind: 'tag', order: 0 },
        { id: 'm', label: 'M', parentId: null, kind: 'tag', order: 0 },
      ],
    };

    const index = buildTaxonomyIndex(taxonomy);
    const rootChildren = index.childrenOf.get(null);

    // Should be sorted by label: A, M, Z
    expect(rootChildren).toEqual(['a', 'm', 'z']);

    // Ordinals should be 0, 1, 2
    expect(index.siblingOrdinal.get('a')).toBe(0);
    expect(index.siblingOrdinal.get('m')).toBe(1);
    expect(index.siblingOrdinal.get('z')).toBe(2);
  });

  it('should handle nodes with same order and same label by id', () => {
    const taxonomy: Taxonomy = {
      schemaVersion: '1.3.1',
      nodes: [
        { id: 'node-z', label: 'Same', parentId: null, kind: 'tag', order: 0 },
        { id: 'node-a', label: 'Same', parentId: null, kind: 'tag', order: 0 },
        { id: 'node-m', label: 'Same', parentId: null, kind: 'tag', order: 0 },
      ],
    };

    const index = buildTaxonomyIndex(taxonomy);
    const rootChildren = index.childrenOf.get(null);

    // Should be sorted by id: node-a, node-m, node-z
    expect(rootChildren).toEqual(['node-a', 'node-m', 'node-z']);
  });
});

