import { useMemo } from 'react';
import type { CSSProperties, Ref } from 'react';
import type { NodeId, TaxonomyIndex } from '@tagselector/tag-core';
import { Tree } from 'react-arborist';
import { ChevronRight, ChevronDown, Folder, Tag } from 'lucide-react';
import { useElementSize } from '@mantine/hooks';
import { indexToTreeData, filterTreeDataByQuery } from './treeDataBuilder';
import type { TreeItem } from './treeDataBuilder';
import styles from './TaxonomyTree.module.css';
import { devWarn as loggerDevWarn } from '../../utils/logger';

/**
 * Local type definition for react-arborist node render props.
 * react-arborist doesn't export NodeProps directly in v3.
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

/**
 * Check if a node is a container (can have children navigated into).
 * A container is either:
 * 1. kind === 'folder'
 * 2. Has children (tree node.isInternal) - covers legacy tag with children
 */
function isContainer(node: { data: TreeItem; isInternal: boolean }): boolean {
  return node.data.kind === 'folder' || node.isInternal;
}

interface TaxonomyTreeProps {
  index: TaxonomyIndex;
  selectedIds: Set<NodeId>;
  onToggleSelect: (nodeId: NodeId) => void;
  onEnterFolder?: (folderId: NodeId) => void;
  searchQuery?: string;
}

// 自定义 Node Renderer
function Node({ 
  node, 
  style, 
  dragHandle,
  selectedIds,
  onToggleSelect,
  onEnterFolder,
}: NodeRenderProps<TreeItem> & { 
  selectedIds: Set<NodeId>; 
  onToggleSelect: (id: NodeId) => void;
  onEnterFolder?: (id: NodeId) => void;
}) {
  // 使用外部 store 的 selectedIds 判断选中态，不依赖 node.isSelected
  const isSelected = selectedIds.has(node.id);
  const nodeIsContainer = isContainer(node);

  const handleClick = () => {
    if (nodeIsContainer && onEnterFolder) {
      // Container click: navigate to folder (don't toggle selection)
      onEnterFolder(node.id);
      
      // Dev warning for legacy data: tag with children
      if (import.meta.env.DEV && node.data.kind === 'tag' && node.isInternal) {
        loggerDevWarn(
          `[TagSelector] Tag "${node.data.label}" (id: ${node.id}) has children. ` +
          `Consider changing to kind:'folder' for semantic consistency.`
        );
      }
    } else {
      // Tag click: toggle selection
      onToggleSelect(node.id);
    }
  };

  return (
    <div
      ref={dragHandle}
      style={style}
      className={`${styles.node} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
    >
      {/* Expand / Collapse */}
      <span
        className={styles.expandButton}
        onClick={(e) => {
          e.stopPropagation();
          node.toggle();
        }}
      >
        {node.isInternal ? (
          node.isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
        ) : null}
      </span>
      {/* Icon */}
      <span className={styles.icon}>
        {node.data.kind === 'folder' ? <Folder size={16} /> : <Tag size={16} />}
      </span>
      {/* Label */}
      <span className={styles.label}>{node.data.label}</span>
    </div>
  );
}

export function TaxonomyTree({
  index,
  selectedIds,
  onToggleSelect,
  onEnterFolder,
  searchQuery = '',
}: TaxonomyTreeProps) {
  const { ref: containerRef, height } = useElementSize();
  const treeHeight = Math.max(200, height);
  // Step 1: 将原始 index 数据转换为 TreeItem[] 格式
  const fullData = useMemo(() => indexToTreeData(index), [index]);

  // Step 2: 根据搜索查询过滤数据
  const filteredData = useMemo(
    () => filterTreeDataByQuery(fullData, searchQuery),
    [fullData, searchQuery]
  );

  // Safety check: ensure all items have valid id
  const validatedData = useMemo(() => {
    return filteredData.filter(item => item && item.id != null);
  }, [filteredData]);

  if (validatedData.length === 0) {
    return (
      <div className={styles.empty}>
        {searchQuery ? 'No matching tags found' : 'No taxonomy loaded'}
      </div>
    );
  }

  // Generate a stable key based on the data to force remount when structure changes
  const treeKey = useMemo(() => {
    return validatedData.map(item => item.id).join('-');
  }, [validatedData]);

  return (
    <div ref={containerRef} className={styles.tree}>
      <Tree<TreeItem>
        key={treeKey}
        data={validatedData}
        width="100%"
        height={treeHeight}
        openByDefault={!!searchQuery}
        indent={24}
        rowHeight={40}
        paddingBottom={12}
        // ⚠️ 完全由外部 store (selectedIds) 管理选中态
        // ⚠️ 不传 onSelect，点击直接调用 onToggleSelect，避免 react-arborist 内部 selection 同步
      >
        {(props) => (
          <Node 
            {...props} 
            selectedIds={selectedIds} 
            onToggleSelect={onToggleSelect}
            onEnterFolder={onEnterFolder}
          />
        )}
      </Tree>
    </div>
  );
}
