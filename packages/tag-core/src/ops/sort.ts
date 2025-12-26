/**
 * TagSelector Core - Sort by User Order
 * Version: 1.3.1
 *
 * Sorts nodes by their pre-computed sortPath.
 *
 * NAMING LOCK: Function name 'sortByUserOrder' is locked and must not be renamed.
 *
 * IMPORTANT: This function ONLY compares sortPath.
 * It does NOT use label as a fallback (sortPath already guarantees uniqueness).
 */

import type { NodeId } from '../models/node.js';
import type { TaxonomyIndex } from '../models/index-types.js';

/**
 * Compare two sortPaths lexicographically.
 *
 * Rules:
 * - Compare element by element
 * - Shorter path that is a prefix comes first (ancestor before descendant)
 *
 * @param pathA - First sortPath
 * @param pathB - Second sortPath
 * @returns Negative if a < b, positive if a > b, zero if equal
 */
function compareSortPaths(pathA: number[], pathB: number[]): number {
  const minLen = Math.min(pathA.length, pathB.length);

  for (let i = 0; i < minLen; i++) {
    if (pathA[i] !== pathB[i]) {
      return pathA[i] - pathB[i];
    }
  }

  // If one is a prefix of the other, shorter comes first (ancestor before descendant)
  return pathA.length - pathB.length;
}

/**
 * Sort node IDs by their user-defined order (via sortPath).
 *
 * @param index - The TaxonomyIndex
 * @param nodeIds - Set of node IDs to sort
 * @returns Array of node IDs sorted by sortPath
 */
export function sortByUserOrder(
  index: TaxonomyIndex,
  nodeIds: Set<NodeId>
): NodeId[] {
  const ids = Array.from(nodeIds);

  ids.sort((a, b) => {
    const pathA = index.sortPathCache.get(a);
    const pathB = index.sortPathCache.get(b);

    if (!pathA || !pathB) {
      throw new Error(`Missing sortPath for node: ${!pathA ? a : b}`);
    }

    return compareSortPaths(pathA, pathB);
  });

  return ids;
}

