/**
 * FolderNavigator
 *
 * Left panel tree component that ONLY shows folders.
 * Click on a folder = navigate to that folder (set currentFolderId).
 * Does NOT toggle tag selection.
 *
 * Key differences from TaxonomyTree:
 * 1. Data source is folder-only (no tags in tree)
 * 2. Click always navigates, never toggles selection
 * 3. All icons are folder icons
 *
 * Expand modes:
 * - 'collapsed': default, all folders start collapsed
 * - 'expanded': all folders start expanded
 * - 'auto': only autoOpenFolderIds are expanded (on user expanding parent)
 */

import { useMemo, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties, Ref } from 'react';
import type { NodeId, TaxonomyIndex } from '@tagselector/tag-core';
import { Tree, TreeApi } from 'react-arborist';
import { ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { useElementSize } from '@mantine/hooks';
import { buildFolderTreeData, filterFolderTreeByQuery } from './folderTreeDataBuilder';
import type { FolderTreeItem } from './folderTreeDataBuilder';
import type { FolderNavigatorConfig } from '../../types/project-pack';
import styles from './TaxonomyTree.module.css';

/**
 * Local type definition for react-arborist node render props.
 * react-arborist doesn't export NodeProps directly.
 */
interface NodeRenderProps<T> {
  node: {
    id: string;
    data: T;
    isInternal: boolean;
    isOpen: boolean;
    toggle: () => void;
  };
  style: CSSProperties;
  dragHandle?: Ref<HTMLDivElement>;
}

interface FolderNavigatorProps {
  index: TaxonomyIndex;
  currentFolderId: NodeId | null;
  onNavigateToFolder: (folderId: NodeId) => void;
  searchQuery?: string;
  folderNavigatorConfig?: FolderNavigatorConfig;
}

/**
 * Custom node renderer for folder-only tree.
 * 
 * Click behavior (stable, no delay):
 * - Single-click row: immediately navigate to folder
 * - Double-click row: toggle expand/collapse (only if node.isInternal)
 * - Click expand button: toggle expand/collapse (no navigation)
 */
function FolderNode({
  node,
  style,
  dragHandle,
  currentFolderId,
  onNavigateToFolder,
  onExpandToggle,
}: NodeRenderProps<FolderTreeItem> & {
  currentFolderId: NodeId | null;
  onNavigateToFolder: (id: NodeId) => void;
  onExpandToggle: (nodeId: string, willOpen: boolean) => void;
}) {
  // Highlight if this folder is the current folder
  const isCurrentFolder = currentFolderId === node.id;

  /**
   * Single-click: immediately navigate to folder.
   * Skipped if clicking on expand button area.
   */
  const handleClick = (e: React.MouseEvent) => {
    // Prevent if clicking on expand button area
    if ((e.target as HTMLElement).closest(`.${styles.expandButton}`)) {
      return;
    }
    // Immediate navigation (no delay)
    onNavigateToFolder(node.id);
  };

  /**
   * Double-click: toggle expand/collapse if node has children.
   * Navigation already happened from the first click.
   */
  const handleDoubleClick = (e: React.MouseEvent) => {
    // Prevent if clicking on expand button area
    if ((e.target as HTMLElement).closest(`.${styles.expandButton}`)) {
      return;
    }
    // Only toggle if node has children (isInternal)
    if (node.isInternal) {
      const willOpen = !node.isOpen;
      node.toggle();
      onExpandToggle(node.id, willOpen);
    }
    // If leaf folder (no children), do nothing extra - navigation already happened
  };

  /**
   * Expand button click: toggle expand/collapse only (no navigation).
   */
  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const willOpen = !node.isOpen;
    node.toggle();
    onExpandToggle(node.id, willOpen);
  };

  return (
    <div
      ref={dragHandle}
      style={style}
      className={`${styles.node} ${isCurrentFolder ? styles.selected : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Expand / Collapse */}
      <span className={styles.expandButton} onClick={handleExpandClick}>
        {node.isInternal ? (
          node.isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
        ) : null}
      </span>
      {/* Folder Icon - always folder, never tag */}
      <span className={styles.icon}>
        <Folder size={16} />
      </span>
      {/* Label */}
      <span className={styles.label}>{node.data.label}</span>
    </div>
  );
}

export function FolderNavigator({
  index,
  currentFolderId,
  onNavigateToFolder,
  searchQuery = '',
  folderNavigatorConfig,
}: FolderNavigatorProps) {
  const treeRef = useRef<TreeApi<FolderTreeItem> | null>(null);
  const { ref: containerRef, height } = useElementSize();
  const treeHeight = Math.max(200, height);

  // Extract config values
  const mode = folderNavigatorConfig?.mode ?? 'collapsed';
  const autoOpenFolderIds = folderNavigatorConfig?.autoOpenFolderIds ?? [];
  const autoOpenSet = useMemo(() => new Set(autoOpenFolderIds), [autoOpenFolderIds]);

  // Compute openByDefault based on mode and searchQuery
  const openByDefault = !!searchQuery || mode === 'expanded';

  // Step 1: Build folder-only tree data
  const fullData = useMemo(() => buildFolderTreeData(index), [index]);

  // Step 2: Filter by search query (folder labels only)
  const filteredData = useMemo(
    () => filterFolderTreeByQuery(fullData, searchQuery),
    [fullData, searchQuery]
  );

  // Safety check: ensure all items have valid id
  const validatedData = useMemo(() => {
    return filteredData.filter((item) => item && item.id != null);
  }, [filteredData]);

  // Generate stable key for tree remount when structure changes
  const treeKey = useMemo(() => {
    return validatedData.map((item) => item.id).join('-');
  }, [validatedData]);

  // Auto mode: open autoOpenFolderIds after tree mount/rebuild
  useEffect(() => {
    if (mode !== 'auto' || searchQuery) {
      return;
    }

    // Small delay to ensure tree is fully mounted
    const timer = setTimeout(() => {
      if (!treeRef.current) return;

      for (const folderId of autoOpenFolderIds) {
        // Validate: must exist in index and be a folder
        const node = index.byId.get(folderId);
        if (!node || node.kind !== 'folder') {
          continue;
        }
        // Open this node (won't force open ancestors)
        treeRef.current.open(folderId);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [treeKey, validatedData, mode, autoOpenFolderIds, searchQuery, index]);

  /**
   * Recursively open descendant folders that are in autoOpenFolderIds.
   * Called when user expands a folder in 'auto' mode.
   */
  const recursiveAutoOpen = useCallback(
    (parentId: NodeId) => {
      if (!treeRef.current) return;

      const childIds = index.childrenOf.get(parentId) || [];
      for (const childId of childIds) {
        const childNode = index.byId.get(childId);
        // Only process folders
        if (!childNode || childNode.kind !== 'folder') {
          continue;
        }
        // If this child is in autoOpenFolderIds, open it and recurse
        if (autoOpenSet.has(childId)) {
          treeRef.current.open(childId);
          recursiveAutoOpen(childId);
        }
      }
    },
    [index, autoOpenSet]
  );

  /**
   * Handle expand/collapse toggle from node.
   * In 'auto' mode, recursively open descendants in autoOpenFolderIds.
   */
  const handleExpandToggle = useCallback(
    (nodeId: string, willOpen: boolean) => {
      if (mode !== 'auto' || !willOpen) {
        return;
      }
      // When expanding in auto mode, check descendants
      recursiveAutoOpen(nodeId);
    },
    [mode, recursiveAutoOpen]
  );

  if (validatedData.length === 0) {
    return (
      <div className={styles.empty}>
        {searchQuery ? '没有匹配的文件夹' : '没有文件夹'}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.tree}>
      <Tree<FolderTreeItem>
        ref={treeRef}
        key={treeKey}
        data={validatedData}
        width="100%"
        height={treeHeight}
        openByDefault={openByDefault}
        indent={24}
        rowHeight={40}
        paddingBottom={12}
      >
        {(props) => (
          <FolderNode
            {...props}
            currentFolderId={currentFolderId}
            onNavigateToFolder={onNavigateToFolder}
            onExpandToggle={handleExpandToggle}
          />
        )}
      </Tree>
    </div>
  );
}
