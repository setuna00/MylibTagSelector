/**
 * TagSelector - Search Match Utilities
 * 
 * Tools for matching nodes by label or aliases (case-insensitive).
 */

import type { TagNode } from '@tagselector/tag-core';

/**
 * Get aliases from a node.
 * 
 * Reads from node.data?.aliases (for wrapped nodes like react-arborist).
 * 
 * @param node - The node (may be TagNode or wrapped with data field)
 * @returns Array of alias strings (trimmed, non-empty)
 */
export function getAliases(node: any): string[] {
  // Read from node.data?.aliases (as specified)
  const aliases = (node as any).data?.aliases;
  
  if (!aliases || !Array.isArray(aliases)) {
    return [];
  }
  
  // Filter: only strings, trim, remove empty
  return aliases
    .filter((a): a is string => typeof a === 'string')
    .map(a => a.trim())
    .filter(a => a.length > 0);
}

/**
 * Check if a node matches the query (case-insensitive).
 * 
 * Matches if either:
 * - node.label contains query (case-insensitive)
 * - any alias contains query (case-insensitive)
 * 
 * @param node - The node (may be TagNode or wrapped with data field)
 * @param query - Search query string
 * @returns true if node matches query, false otherwise
 */
export function nodeMatchesQuery(node: any, query: string): boolean {
  // Empty query -> no match
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return false;
  }
  
  const q = trimmedQuery.toLowerCase();
  
  // Get label (support both direct and wrapped nodes)
  const label = (node as any).data?.label ?? (node as TagNode).label;
  if (typeof label !== 'string') {
    return false;
  }
  
  // Check label match
  const labelMatch = label.toLowerCase().includes(q);
  
  // Check aliases match
  const aliases = getAliases(node);
  const aliasMatch = aliases.some(a => a.toLowerCase().includes(q));
  
  return labelMatch || aliasMatch;
}

