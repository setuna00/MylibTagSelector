/**
 * TagSelector Core - Index Builder
 * Version: 1.3.1
 *
 * Builds TaxonomyIndex with pre-computed childrenOf, siblingOrdinal, and sortPathCache.
 *
 * NAMING LOCK: Function names 'buildTaxonomyIndex' and 'computeSortPath' are locked.
 */

import type { NodeId, TagNode } from '../models/node.js';
import type { Taxonomy } from '../models/taxonomy.js';
import type { TaxonomyIndex } from '../models/index-types.js';
import { compareNodes } from './compare.js';

/**
 * Compute the sortPath for a single node.
 *
 * sortPath = [ancestor1.ordinal, ancestor2.ordinal, ..., self.ordinal]
 * This is the ordinal sequence from root to the node.
 *
 * @param byId - Map of NodeId to TagNode
 * @param siblingOrdinal - Map of NodeId to ordinal
 * @param nodeId - The node to compute sortPath for
 * @returns The sortPath (array of ordinals from root to node)
 */
export function computeSortPath(
  byId: Map<NodeId, TagNode>,
  siblingOrdinal: Map<NodeId, number>,
  nodeId: NodeId
): number[] {
  const path: number[] = [];
  let currentId: NodeId | null = nodeId;

  while (currentId !== null) {
    const ordinal = siblingOrdinal.get(currentId);
    if (ordinal === undefined) {
      throw new Error(`Missing ordinal for node: ${currentId}`);
    }
    path.unshift(ordinal); // Add to front (root to leaf order)
    const node = byId.get(currentId);
    currentId = node?.parentId ?? null;
  }

  return path;
}

/**
 * Build a TaxonomyIndex from a Taxonomy.
 *
 * This pre-computes:
 * - byId: Quick lookup by NodeId
 * - childrenOf: Children of each parent, sorted by compareNodes
 * - siblingOrdinal: 0-based index within parent's sorted children
 * - sortPathCache: Pre-computed sortPath for each node
 *
 * @param taxonomy - The source taxonomy
 * @returns The built TaxonomyIndex
 */
export function buildTaxonomyIndex(taxonomy: Taxonomy): TaxonomyIndex {
  const byId = new Map<NodeId, TagNode>();
  const childrenOfRaw = new Map<NodeId | null, TagNode[]>();

  // Step 1: Build byId and collect children for each parent
  for (const node of taxonomy.nodes) {
    byId.set(node.id, node);

    const parentId = node.parentId;
    if (!childrenOfRaw.has(parentId)) {
      childrenOfRaw.set(parentId, []);
    }
    childrenOfRaw.get(parentId)!.push(node);
  }

  // Step 2: Sort children and build childrenOf (with NodeId arrays)
  const childrenOf = new Map<NodeId | null, NodeId[]>();
  for (const [parentId, children] of childrenOfRaw) {
    // Sort using compareNodes (order ASC, label ASC, id ASC)
    children.sort(compareNodes);
    childrenOf.set(parentId, children.map((c) => c.id));
  }

  // Step 3: Build siblingOrdinal
  const siblingOrdinal = new Map<NodeId, number>();
  for (const [, childIds] of childrenOf) {
    childIds.forEach((id, index) => {
      siblingOrdinal.set(id, index);
    });
  }

  // Step 4: Build sortPathCache
  const sortPathCache = new Map<NodeId, number[]>();
  for (const nodeId of byId.keys()) {
    sortPathCache.set(nodeId, computeSortPath(byId, siblingOrdinal, nodeId));
  }

  return {
    taxonomy,
    byId,
    childrenOf,
    siblingOrdinal,
    sortPathCache,
  };
}

