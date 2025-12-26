/**
 * TagSelector Core - compareNodes
 * Version: 1.3.1
 *
 * DETERMINISM CONTRACT (确定性合约):
 * - Comparison uses UTF-16 code unit lexicographic order (JS default string order)
 * - FORBIDDEN: localeCompare(), Intl.Collator, any locale-sensitive comparison
 *
 * NAMING LOCK: Function name 'compareNodes' is locked and must not be renamed.
 */

import type { TagNode } from '../models/node.js';

/**
 * Compare two strings using UTF-16 code unit lexicographic order.
 *
 * This is equivalent to JavaScript's default string comparison (< and >),
 * which compares strings character by character using charCodeAt().
 *
 * IMPORTANT: This is NOT natural sort order!
 * Example: "A1" < "A10" < "A2" (because '0' (48) < '2' (50))
 *
 * @param a - First string
 * @param b - Second string
 * @returns Negative if a < b, positive if a > b, zero if equal
 */
export function compareStringsUTF16(a: string, b: string): number {
  // JavaScript's default string comparison uses UTF-16 code units
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Compare two TagNodes for sorting.
 *
 * Comparison rules (in order):
 * 1. order ASC: a.order - b.order
 * 2. label ASC: UTF-16 code unit lexicographic order
 * 3. id ASC: UTF-16 code unit lexicographic order (final tie-breaker)
 *
 * FORBIDDEN: localeCompare(), Intl.Collator, any locale-sensitive comparison
 *
 * @param a - First node
 * @param b - Second node
 * @returns Negative if a < b, positive if a > b, zero if equal
 */
export function compareNodes(a: TagNode, b: TagNode): number {
  // 1. Compare by order (ascending)
  if (a.order !== b.order) {
    return a.order - b.order;
  }

  // 2. Compare by label (UTF-16 code unit lexicographic order)
  const labelCmp = compareStringsUTF16(a.label, b.label);
  if (labelCmp !== 0) {
    return labelCmp;
  }

  // 3. Compare by id (UTF-16 code unit lexicographic order, final tie-breaker)
  return compareStringsUTF16(a.id, b.id);
}

