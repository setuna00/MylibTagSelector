/**
 * TagSelector Core - Export Set Computation
 * Version: 1.3.1
 *
 * Computes the final export set from selected nodes.
 */

import type { NodeId } from '../models/node.js';
import type { TaxonomyIndex } from '../models/index-types.js';
import { shouldExport } from '../models/node.js';
import { computeClosure } from './closure.js';

export interface ExportSetOptions {
  /** Whether to include ancestor closure. Default: true */
  includeAncestors?: boolean;
}

/**
 * Compute the final export set from selected nodes.
 *
 * Algorithm:
 * 1. If includeAncestors is true, compute closure (selected + ancestors)
 * 2. Filter to only nodes where shouldExport(node) is true
 *
 * @param index - The TaxonomyIndex
 * @param selectedIds - Set of user-selected node IDs
 * @param options - Options for export set computation
 * @returns Set of node IDs to export
 */
export function computeExportSet(
  index: TaxonomyIndex,
  selectedIds: Set<NodeId>,
  options: ExportSetOptions = {}
): Set<NodeId> {
  const { includeAncestors = true } = options;

  // Step 1: Get the candidate set (with or without closure)
  const candidates = includeAncestors
    ? computeClosure(index, selectedIds)
    : selectedIds;

  // Step 2: Filter by shouldExport
  const exportSet = new Set<NodeId>();
  for (const nodeId of candidates) {
    const node = index.byId.get(nodeId);
    if (node && shouldExport(node)) {
      exportSet.add(nodeId);
    }
  }

  return exportSet;
}

