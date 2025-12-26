/**
 * TagSelector Core - Format for Mylio
 * Version: 1.3.1
 *
 * Formats sorted node IDs as a comma-separated string for Mylio.
 */

import type { NodeId } from '../models/node.js';
import type { TaxonomyIndex } from '../models/index-types.js';

/** Default separator for Mylio keywords */
export const DEFAULT_SEPARATOR = ', ';

/**
 * Format sorted node IDs as a string for Mylio.
 *
 * @param index - The TaxonomyIndex
 * @param sortedIds - Array of node IDs (already sorted)
 * @param separator - Separator between labels. Default: ", "
 * @returns Formatted string of labels
 */
export function formatForMylio(
  index: TaxonomyIndex,
  sortedIds: NodeId[],
  separator: string = DEFAULT_SEPARATOR
): string {
  const labels: string[] = [];

  for (const nodeId of sortedIds) {
    const node = index.byId.get(nodeId);
    if (node) {
      labels.push(node.label);
    }
  }

  return labels.join(separator);
}

