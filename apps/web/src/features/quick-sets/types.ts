/**
 * QuickSet Types
 *
 * Type definitions for QuickSet internal structure.
 * 
 * Key constraints:
 * - QuickSet internal structure is completely independent of main taxonomy tree
 * - Only two node types allowed:
 *   1) QSFolder: User-created folders/groups, can be nested arbitrarily
 *   2) QSTag: Tag reference (must be leaf, no children allowed)
 * - No main tree folder references allowed in QuickSet
 */

import type { NodeId } from '@tagselector/tag-core';

/**
 * A user-created folder/group in a QuickSet.
 * Can contain nested folders and tags.
 */
export interface QSFolder {
  id: string;
  type: 'folder';
  name: string;
  children: QSNode[];
}

/**
 * A tag reference in a QuickSet.
 * Must always be a leaf node (no children).
 * References a tag ID from the main taxonomy tree.
 */
export interface QSTag {
  type: 'tag';
  tagId: NodeId;
  /** Optional display name override (shown instead of main tree label) */
  displayNameOverride?: string;
}

/**
 * A node in a QuickSet - either a folder or a tag reference.
 */
export type QSNode = QSFolder | QSTag;

/**
 * A QuickSet with the new internal structure.
 * - id: Unique identifier for the QuickSet
 * - name: Display name
 * - root: Root folder containing all content
 */
export interface QuickSet {
  id: string;
  name: string;
  root: QSFolder;
}

/**
 * Generate a unique ID for QuickSet nodes.
 */
export function generateQSId(): string {
  return `qs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a new empty QuickSet with a root folder.
 */
export function createEmptyQuickSet(name: string): QuickSet {
  return {
    id: generateQSId(),
    name,
    root: {
      id: 'root',
      type: 'folder',
      name: 'root',
      children: [],
    },
  };
}

/**
 * Create a new empty folder node.
 */
export function createEmptyFolder(name: string): QSFolder {
  return {
    id: generateQSId(),
    type: 'folder',
    name,
    children: [],
  };
}

/**
 * Create a tag reference node.
 */
export function createTagRef(tagId: NodeId, displayNameOverride?: string): QSTag {
  return {
    type: 'tag',
    tagId,
    ...(displayNameOverride ? { displayNameOverride } : {}),
  };
}

