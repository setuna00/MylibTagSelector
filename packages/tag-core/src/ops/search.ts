/**
 * TagSelector Core - Search Nodes
 * Version: 1.3.1
 *
 * Search nodes by label and aliases.
 */

import type { TagNode } from '../models/node.js';
import type { TaxonomyIndex } from '../models/index-types.js';

/**
 * Search nodes by matching label or aliases.
 *
 * The search is case-insensitive and matches partial strings.
 *
 * @param index - The TaxonomyIndex
 * @param query - Search query string
 * @returns Array of matching TagNodes
 */
export function searchNodes(index: TaxonomyIndex, query: string): TagNode[] {
  if (!query.trim()) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const results: TagNode[] = [];

  for (const node of index.byId.values()) {
    // Check label
    if (node.label.toLowerCase().includes(lowerQuery)) {
      results.push(node);
      continue;
    }

    // Check aliases
    if (node.aliases) {
      const aliasMatch = node.aliases.some((alias) =>
        alias.toLowerCase().includes(lowerQuery)
      );
      if (aliasMatch) {
        results.push(node);
      }
    }
  }

  return results;
}

