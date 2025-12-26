/**
 * TagSelector - Search Match Utilities
 * 
 * Tools for matching nodes by label, displayName, or aliases (case-insensitive).
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
 * Get displayName from a node.
 * 
 * Reads from node.data?.displayName.
 * 
 * @param node - The node (may be TagNode or wrapped with data field)
 * @returns displayName string or undefined
 */
export function getDisplayName(node: any): string | undefined {
  const nodeWithData = node as TagNode & { data?: { displayName?: string } };
  const displayName = nodeWithData.data?.displayName;
  if (typeof displayName === 'string' && displayName.trim().length > 0) {
    return displayName.trim();
  }
  return undefined;
}

/**
 * Get display label for a tag node (for UI display, not export).
 * 
 * Uses displayName if available, otherwise falls back to label.
 * This should be used everywhere in the UI except for export preview.
 * 
 * @param node - The node (may be TagNode or wrapped with data field)
 * @returns Display label string
 */
export function getTagDisplayLabel(node: any): string {
  const displayName = getDisplayName(node);
  if (displayName) {
    return displayName;
  }
  // Fallback to label
  const label = (node as any).data?.label ?? (node as TagNode).label;
  return typeof label === 'string' ? label : '';
}

/**
 * Check if a node matches the query (case-insensitive).
 * 
 * Matches if any of the following contains the query:
 * - node.label
 * - node.data.displayName (if present)
 * - node.data.aliases (if present)
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
  
  // Check displayName match
  const displayName = getDisplayName(node);
  const displayNameMatch = displayName ? displayName.toLowerCase().includes(q) : false;
  
  // Check aliases match
  const aliases = getAliases(node);
  const aliasMatch = aliases.some(a => a.toLowerCase().includes(q));
  
  return labelMatch || displayNameMatch || aliasMatch;
}

