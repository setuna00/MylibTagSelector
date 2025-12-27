/**
 * TagSelector - Search Match Utilities
 *
 * Tools for matching nodes by label, displayName, or aliases (case-insensitive).
 */

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null;
}

function asNonEmptyTrimmedString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

/**
 * Returns a record that contains the tag's metadata fields (displayName/aliases),
 * supporting both shapes:
 * - TagNode: node.data contains displayName/aliases
 * - Wrapped node: node.data is TagNode-like, and node.data.data contains displayName/aliases
 */
function getTagDataObject(node: unknown): UnknownRecord | undefined {
  if (!isRecord(node)) return undefined;

  const data = node['data'];
  if (!isRecord(data)) return undefined;

  // Case 1: node.data is already the data object
  if ('displayName' in data || 'aliases' in data) {
    return data;
  }

  // Case 2: node.data is TagNode-like; check nested data
  const nested = data['data'];
  if (isRecord(nested)) {
    return nested;
  }

  return undefined;
}

/**
 * Get label from a node.
 *
 * Supports both shapes:
 * - Wrapped node: node.data.label
 * - TagNode: node.label
 */
function getLabel(node: unknown): string | undefined {
  if (!isRecord(node)) return undefined;

  const data = node['data'];
  if (isRecord(data)) {
    const fromDataLabel = asNonEmptyTrimmedString(data['label']);
    if (fromDataLabel) return fromDataLabel;
  }

  return asNonEmptyTrimmedString(node['label']);
}

/**
 * Get aliases from a node.
 *
 * Reads from tagData.aliases (see getTagDataObject).
 */
export function getAliases(node: unknown): string[] {
  const data = getTagDataObject(node);
  if (!data) return [];

  const aliases = data['aliases'];
  if (!Array.isArray(aliases)) {
    return [];
  }

  return aliases
    .filter((a): a is string => typeof a === 'string')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

/**
 * Get displayName from a node.
 *
 * Reads from tagData.displayName (see getTagDataObject).
 */
export function getDisplayName(node: unknown): string | undefined {
  const data = getTagDataObject(node);
  if (!data) return undefined;

  return asNonEmptyTrimmedString(data['displayName']);
}

/**
 * Get display label for a tag node (for UI display, not export).
 *
 * Uses displayName if available, otherwise falls back to label.
 */
export function getTagDisplayLabel(node: unknown): string {
  const displayName = getDisplayName(node);
  if (displayName) {
    return displayName;
  }

  return getLabel(node) ?? '';
}

/**
 * Check if a node matches the query (case-insensitive).
 *
 * Matches if any of the following contains the query:
 * - label
 * - displayName
 * - aliases
 */
export function nodeMatchesQuery(node: unknown, query: string): boolean {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return false;
  }

  const q = trimmedQuery.toLowerCase();

  const label = getLabel(node);
  if (!label) return false;

  const labelMatch = label.toLowerCase().includes(q);

  const displayName = getDisplayName(node);
  const displayNameMatch = displayName ? displayName.toLowerCase().includes(q) : false;

  const aliases = getAliases(node);
  const aliasMatch = aliases.some((a) => a.toLowerCase().includes(q));

  return labelMatch || displayNameMatch || aliasMatch;
}

