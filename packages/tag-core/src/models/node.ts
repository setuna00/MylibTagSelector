/**
 * TagSelector Core - Node Types
 * Version: 1.3.1
 *
 * Core type definitions for taxonomy nodes.
 *
 * IMPORTANT SEMANTIC RULES (禁止违反):
 * - tag ≠ leaf: A tag node CAN have children
 * - folder ≠ parent: A folder CAN be empty (no children)
 * - kind and children have NO strong binding
 */

/** Unique identifier for a node */
export type NodeId = string;

/**
 * Node kind:
 * - 'folder': Container node, default shouldExport = false
 * - 'tag': Tag node, default shouldExport = true
 */
export type NodeKind = 'folder' | 'tag';

/**
 * A node in the taxonomy tree.
 *
 * Note: A tag node CAN have children (tag ≠ leaf).
 * Note: A folder node CAN be empty (folder ≠ parent).
 */
export interface TagNode {
  /** Unique identifier */
  id: NodeId;

  /** Display label (must not contain comma) */
  label: string;

  /** Parent node ID, null for root nodes */
  parentId: NodeId | null;

  /** Node kind: folder or tag */
  kind: NodeKind;

  /**
   * User-defined sort weight (integer).
   * Used for sorting siblings within the same parent.
   */
  order: number;

  /** Search aliases (only for matching, not exported) */
  aliases?: string[];

  /**
   * Override default export behavior.
   * - undefined: use default based on kind (folder=false, tag=true)
   * - true: force export
   * - false: force no export
   */
  export?: boolean;

  /** Extension metadata */
  meta?: Record<string, unknown>;

  /**
   * Additional data fields (preserved from JSON import).
   * - recommendedTagIds: Array of tag IDs (only for tag nodes, not folders)
   */
  data?: {
    /** Recommended tag IDs (only for tag nodes, not folders) */
    recommendedTagIds?: string[];
    /** Other data fields (e.g., color, displayName, aliases) */
    [key: string]: unknown;
  };
}

/**
 * Determine if a node should be exported.
 *
 * Rules:
 * - If node.export is explicitly set, use that value
 * - Otherwise: folder defaults to false, tag defaults to true
 */
export function shouldExport(node: TagNode): boolean {
  if (node.export !== undefined) {
    return node.export;
  }
  return node.kind === 'tag';
}

/**
 * Get recommended tag IDs from a node.
 * 
 * Returns an empty array if:
 * - node is not a tag (kind !== 'tag')
 * - node.data is missing
 * - node.data.recommendedTagIds is missing or invalid
 * 
 * @param node - The node to read from
 * @returns Array of recommended tag IDs (always an array, never undefined)
 */
export function getRecommendedTagIds(node: TagNode): string[] {
  // Only tag nodes have recommendedTagIds
  if (node.kind !== 'tag') {
    return [];
  }

  const recommendedTagIds = node.data?.recommendedTagIds;
  
  // Return empty array if missing or not an array
  if (!Array.isArray(recommendedTagIds)) {
    return [];
  }

  // Filter to ensure all items are strings
  return recommendedTagIds.filter((id): id is string => typeof id === 'string');
}

