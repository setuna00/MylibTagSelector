/**
 * TagSelector Core - Closure Computation
 * Version: 1.3.1
 *
 * Computes the ancestor closure for selected nodes.
 *
 * IMPORTANT: Closure only includes ANCESTORS, not descendants.
 */

import type { NodeId } from '../models/node.js';
import type { TaxonomyIndex } from '../models/index-types.js';

/**
 * Compute the ancestor closure for the given selected node IDs.
 *
 * The closure includes:
 * - All selected nodes
 * - All ancestors of selected nodes (up to root)
 *
 * The closure does NOT include:
 * - Descendants of selected nodes
 *
 * @param index - The TaxonomyIndex
 * @param selectedIds - Set of user-selected node IDs
 * @returns Set of all node IDs in the closure
 */
export function computeClosure(
  index: TaxonomyIndex,
  selectedIds: Set<NodeId>
): Set<NodeId> {
  const closure = new Set<NodeId>();

  for (const nodeId of selectedIds) {
    let currentId: NodeId | null = nodeId;

    while (currentId !== null) {
      // If already in closure, we've already traced this path
      if (closure.has(currentId)) {
        break;
      }

      closure.add(currentId);

      // Move to parent
      const node = index.byId.get(currentId);
      currentId = node?.parentId ?? null;
    }
  }

  return closure;
}

