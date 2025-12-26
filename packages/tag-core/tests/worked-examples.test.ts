/**
 * TagSelector Core - Worked Examples Tests
 * Version: 1.3.1
 *
 * These tests verify the two main worked examples from the spec.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTaxonomyIndex,
  computeExportSet,
  sortByUserOrder,
  formatForMylio,
  importTaxonomy,
} from '../src/index.js';
import type { Taxonomy } from '../src/index.js';

// Sample data from taxonomy-clothing.json
const clothingTaxonomy: Taxonomy = {
  schemaVersion: '1.3.1',
  meta: { name: 'Clothing Tags' },
  nodes: [
    { id: 'occupation', label: '职业', parentId: null, kind: 'folder', order: 0 },
    { id: 'student', label: '学生', parentId: 'occupation', kind: 'tag', order: 0 },
    { id: 'jk', label: 'JK', parentId: 'student', kind: 'tag', order: 0 },
    { id: 'maid', label: '女仆', parentId: 'occupation', kind: 'tag', order: 1 },

    { id: 'clothing', label: '衣服', parentId: null, kind: 'folder', order: 1 },
    { id: 'upper', label: '上半身', parentId: 'clothing', kind: 'folder', order: 0 },
    { id: 'sailor', label: '水手服', parentId: 'upper', kind: 'tag', order: 0 },
    { id: 'shirt', label: '衬衫', parentId: 'upper', kind: 'tag', order: 1 },
    { id: 'lower', label: '下半身', parentId: 'clothing', kind: 'folder', order: 1 },
    { id: 'short-skirt', label: '短裙', parentId: 'lower', kind: 'tag', order: 0 },
    { id: 'long-skirt', label: '长裙', parentId: 'lower', kind: 'tag', order: 1 },

    { id: 'shoes', label: '鞋', parentId: null, kind: 'folder', order: 2 },
    { id: 'loafer', label: '乐福鞋', parentId: 'shoes', kind: 'tag', order: 0 },
    { id: 'heels', label: '高跟鞋', parentId: 'shoes', kind: 'tag', order: 1 },

    { id: 'stockings', label: '丝袜', parentId: null, kind: 'tag', order: 3 },
    { id: 'black-stockings', label: '黑丝', parentId: 'stockings', kind: 'tag', order: 0 },
    { id: 'white-stockings', label: '白丝', parentId: 'stockings', kind: 'tag', order: 1 },
  ],
};

// Sample data from taxonomy-bodyparts.json
const bodypartsTaxonomy: Taxonomy = {
  schemaVersion: '1.3.1',
  meta: { name: 'Body Parts Tags' },
  nodes: [
    { id: 'uniform', label: '制服', parentId: null, kind: 'tag', order: 0 },
    { id: 'uniform-upper', label: '上半身', parentId: 'uniform', kind: 'tag', order: 0 },
    { id: 'white-shirt', label: '白衬衫', parentId: 'uniform-upper', kind: 'tag', order: 0 },
    { id: 'tie', label: '领带', parentId: 'uniform-upper', kind: 'tag', order: 1 },
    { id: 'uniform-lower', label: '下半身', parentId: 'uniform', kind: 'tag', order: 1 },
    { id: 'trousers', label: '西裤', parentId: 'uniform-lower', kind: 'tag', order: 0 },
    { id: 'belt', label: '皮带', parentId: 'uniform-lower', kind: 'tag', order: 1 },

    { id: 'casual', label: '休闲', parentId: null, kind: 'tag', order: 1 },
    { id: 'tshirt', label: 'T恤', parentId: 'casual', kind: 'tag', order: 0 },
  ],
};

describe('Worked Example 1: 职业/衣服/鞋/丝袜场景', () => {
  const index = buildTaxonomyIndex(clothingTaxonomy);

  it('should correctly build the index', () => {
    expect(index.byId.size).toBe(17);
    expect(index.childrenOf.get(null)?.length).toBe(4); // 4 root nodes
  });

  it('should have correct sortPaths for root nodes', () => {
    expect(index.sortPathCache.get('occupation')).toEqual([0]);
    expect(index.sortPathCache.get('clothing')).toEqual([1]);
    expect(index.sortPathCache.get('shoes')).toEqual([2]);
    expect(index.sortPathCache.get('stockings')).toEqual([3]);
  });

  it('should have correct sortPaths for nested nodes', () => {
    expect(index.sortPathCache.get('student')).toEqual([0, 0]);
    expect(index.sortPathCache.get('jk')).toEqual([0, 0, 0]);
    expect(index.sortPathCache.get('sailor')).toEqual([1, 0, 0]);
    expect(index.sortPathCache.get('short-skirt')).toEqual([1, 1, 0]);
    expect(index.sortPathCache.get('loafer')).toEqual([2, 0]);
    expect(index.sortPathCache.get('black-stockings')).toEqual([3, 0]);
  });

  it('should compute correct export set and output for the main example', () => {
    // User selects: JK, 黑丝, 水手服, 短裙, 乐福鞋
    const selectedIds = new Set(['jk', 'black-stockings', 'sailor', 'short-skirt', 'loafer']);

    // Compute export set (with ancestor closure, filtered by shouldExport)
    const exportSet = computeExportSet(index, selectedIds);

    // Expected export set: 学生, JK, 水手服, 短裙, 乐福鞋, 丝袜, 黑丝
    // (folders like 职业, 衣服, 上半身, 下半身, 鞋 are excluded)
    expect(exportSet.has('student')).toBe(true);
    expect(exportSet.has('jk')).toBe(true);
    expect(exportSet.has('sailor')).toBe(true);
    expect(exportSet.has('short-skirt')).toBe(true);
    expect(exportSet.has('loafer')).toBe(true);
    expect(exportSet.has('stockings')).toBe(true);
    expect(exportSet.has('black-stockings')).toBe(true);

    // Folders should NOT be in export set
    expect(exportSet.has('occupation')).toBe(false);
    expect(exportSet.has('clothing')).toBe(false);
    expect(exportSet.has('upper')).toBe(false);
    expect(exportSet.has('lower')).toBe(false);
    expect(exportSet.has('shoes')).toBe(false);

    // Sort by user order
    const sortedIds = sortByUserOrder(index, exportSet);

    // Format for Mylio
    const output = formatForMylio(index, sortedIds);

    // Expected output: 学生, JK, 水手服, 短裙, 乐福鞋, 丝袜, 黑丝
    expect(output).toBe('学生, JK, 水手服, 短裙, 乐福鞋, 丝袜, 黑丝');
  });

  it('should not include siblings that were not selected', () => {
    // Select JK but not 女仆
    const selectedIds = new Set(['jk']);
    const exportSet = computeExportSet(index, selectedIds);

    expect(exportSet.has('student')).toBe(true);
    expect(exportSet.has('jk')).toBe(true);
    expect(exportSet.has('maid')).toBe(false); // Not selected

    const sortedIds = sortByUserOrder(index, exportSet);
    const output = formatForMylio(index, sortedIds);
    expect(output).toBe('学生, JK');
  });

  it('should only export the selected tag, not its children', () => {
    // Select only 学生 (which has children)
    const selectedIds = new Set(['student']);
    const exportSet = computeExportSet(index, selectedIds);

    expect(exportSet.has('student')).toBe(true);
    expect(exportSet.has('jk')).toBe(false); // Child not selected

    const sortedIds = sortByUserOrder(index, exportSet);
    const output = formatForMylio(index, sortedIds);
    expect(output).toBe('学生');
  });

  it('should export top-level tag with children when selected', () => {
    // Select only 丝袜 (top-level tag with children)
    const selectedIds = new Set(['stockings']);
    const exportSet = computeExportSet(index, selectedIds);

    expect(exportSet.has('stockings')).toBe(true);
    expect(exportSet.has('black-stockings')).toBe(false); // Child not selected

    const sortedIds = sortByUserOrder(index, exportSet);
    const output = formatForMylio(index, sortedIds);
    expect(output).toBe('丝袜');
  });
});

describe('Worked Example 2: 制服场景 (tag-with-deep-children)', () => {
  const index = buildTaxonomyIndex(bodypartsTaxonomy);

  it('should correctly build the index', () => {
    expect(index.byId.size).toBe(9);
    expect(index.childrenOf.get(null)?.length).toBe(2); // 2 root nodes
  });

  it('should have correct sortPaths', () => {
    expect(index.sortPathCache.get('uniform')).toEqual([0]);
    expect(index.sortPathCache.get('uniform-upper')).toEqual([0, 0]);
    expect(index.sortPathCache.get('white-shirt')).toEqual([0, 0, 0]);
    expect(index.sortPathCache.get('uniform-lower')).toEqual([0, 1]);
    expect(index.sortPathCache.get('belt')).toEqual([0, 1, 1]);
    expect(index.sortPathCache.get('casual')).toEqual([1]);
  });

  it('should compute correct export set and output for the main example', () => {
    // User selects: 白衬衫, 皮带
    const selectedIds = new Set(['white-shirt', 'belt']);

    // Compute export set
    const exportSet = computeExportSet(index, selectedIds);

    // All are tags, so all should be included
    expect(exportSet.has('uniform')).toBe(true); // ancestor
    expect(exportSet.has('uniform-upper')).toBe(true); // ancestor
    expect(exportSet.has('white-shirt')).toBe(true); // selected
    expect(exportSet.has('uniform-lower')).toBe(true); // ancestor
    expect(exportSet.has('belt')).toBe(true); // selected

    // These should NOT be included
    expect(exportSet.has('tie')).toBe(false); // sibling not selected
    expect(exportSet.has('trousers')).toBe(false); // sibling not selected
    expect(exportSet.has('casual')).toBe(false); // not in closure
    expect(exportSet.has('tshirt')).toBe(false); // not in closure

    // Sort and format
    const sortedIds = sortByUserOrder(index, exportSet);
    const output = formatForMylio(index, sortedIds);

    // Expected: 制服, 上半身, 白衬衫, 下半身, 皮带
    expect(output).toBe('制服, 上半身, 白衬衫, 下半身, 皮带');
  });
});

describe('Round-trip test', () => {
  it('should preserve taxonomy structure after import/export/import', () => {
    const jsonString = JSON.stringify(clothingTaxonomy, null, 2);

    // Import
    const result1 = importTaxonomy(jsonString);
    expect(result1.success).toBe(true);
    expect(result1.taxonomy).toBeDefined();

    // Export
    const exported = JSON.stringify(result1.taxonomy, null, 2);

    // Import again
    const result2 = importTaxonomy(exported);
    expect(result2.success).toBe(true);
    expect(result2.taxonomy).toBeDefined();

    // Verify nodes are the same
    expect(result2.taxonomy!.nodes.length).toBe(clothingTaxonomy.nodes.length);

    for (const originalNode of clothingTaxonomy.nodes) {
      const importedNode = result2.taxonomy!.nodes.find((n) => n.id === originalNode.id);
      expect(importedNode).toBeDefined();
      expect(importedNode!.label).toBe(originalNode.label);
      expect(importedNode!.parentId).toBe(originalNode.parentId);
      expect(importedNode!.kind).toBe(originalNode.kind);
      expect(importedNode!.order).toBe(originalNode.order);
    }
  });
});

