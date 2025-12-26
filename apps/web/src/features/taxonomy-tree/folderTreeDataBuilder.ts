/**
 * Folder-Only Tree Data Builder
 *
 * Builds tree data containing ONLY folder nodes.
 * Used for the left navigator panel that only shows folders for navigation.
 * Tags are NOT included in this tree data.
 */

import type { NodeId, TaxonomyIndex } from '@tagselector/tag-core';

// TreeItem 类型定义 - folder-only
export interface FolderTreeItem {
  id: NodeId;
  label: string;
  children?: FolderTreeItem[];
  isLeaf?: boolean;
}

/**
 * Build folder-only tree data from TaxonomyIndex.
 * Only includes nodes where kind === 'folder'.
 * Maintains original order from index.childrenOf.
 */
export function buildFolderTreeData(index: TaxonomyIndex): FolderTreeItem[] {
  const buildTree = (parentId: NodeId | null): FolderTreeItem[] => {
    // Get children of current parent
    const childrenIds = index.childrenOf.get(parentId) || [];

    // Filter to only folders and build recursively
    const folderNodes: FolderTreeItem[] = [];

    for (const nodeId of childrenIds) {
      const node = index.byId.get(nodeId);
      if (!node) continue;

      // ONLY include folders
      if (node.kind !== 'folder') continue;

      // Recursively build children (which will also be folders only)
      const children = buildTree(nodeId);

      folderNodes.push({
        id: node.id,
        label: node.label,
        isLeaf: children.length === 0,
        children: children.length > 0 ? children : undefined,
      });
    }

    return folderNodes;
  };

  // Start from root (parentId = null)
  return buildTree(null);
}

/**
 * Filter folder tree data by search query.
 * Only matches folder labels (not tags, since they're not in the tree).
 * Preserves ancestors of matching nodes.
 */
export function filterFolderTreeByQuery(
  data: FolderTreeItem[],
  query: string
): FolderTreeItem[] {
  // Empty query: return original data
  if (!query.trim()) {
    return data;
  }

  const lowerQuery = query.toLowerCase();

  const filterRecursive = (items: FolderTreeItem[]): FolderTreeItem[] => {
    const result: FolderTreeItem[] = [];

    for (const item of items) {
      // Recursively filter children first
      const filteredChildren = item.children
        ? filterRecursive(item.children)
        : [];

      // Include if: has matching children OR current label matches
      const hasMatchingChildren = filteredChildren.length > 0;
      const currentNodeMatches = item.label.toLowerCase().includes(lowerQuery);

      if (currentNodeMatches || hasMatchingChildren) {
        result.push({
          ...item,
          children: filteredChildren.length > 0 ? filteredChildren : undefined,
        });
      }
    }

    return result;
  };

  return filterRecursive(data);
}

