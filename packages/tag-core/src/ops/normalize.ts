/**
 * TagSelector Core - Label Normalization
 * Version: 1.3.1
 */

/**
 * Normalize a label string.
 *
 * Operations:
 * - Trim leading/trailing whitespace
 * - Collapse consecutive whitespace to single space
 * - Replace newlines with space
 *
 * @param label - The label to normalize
 * @returns Normalized label
 */
export function normalizeLabel(label: string): string {
  return label
    .trim()
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ');
}

