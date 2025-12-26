import type { NodeId, TaxonomyIndex } from '@tagselector/tag-core';

// TreeItem 类型定义 - 最简单嵌套 children 模式
export interface TreeItem {
  id: NodeId;
  label: string;
  children?: TreeItem[];
  isLeaf?: boolean;
  kind?: 'folder' | 'tag';
}

// 将 TaxonomyIndex 转换为 TreeItem[] 数组
// 关键约束：严格保持 index.childrenOf 的原始顺序，不做任何排序
export function indexToTreeData(index: TaxonomyIndex): TreeItem[] {
  const buildTree = (parentId: NodeId | null): TreeItem[] => {
    // 关键：直接从 index.childrenOf 获取数组，保持原始顺序
    const childrenIds = index.childrenOf.get(parentId) || [];
    
    return childrenIds.map((nodeId: NodeId) => {
      const node = index.byId.get(nodeId);
      if (!node) return null;
      
      const children = buildTree(nodeId);
      
      return {
        id: node.id,
        label: node.label,
        kind: node.kind,
        isLeaf: children.length === 0,
        children: children.length > 0 ? children : undefined,
      };
    }).filter(Boolean) as TreeItem[];
  };
  
  // 从根节点开始构建（parentId = null）
  return buildTree(null);
}

// 根据查询过滤 TreeItem[] 数组
// 关键约束：只保留匹配节点及其祖先，保持 index.childrenOf 原始顺序
export function filterTreeDataByQuery(data: TreeItem[], query: string): TreeItem[] {
  // query 为空：直接返回原 data（结构共享）
  if (!query.trim()) {
    return data;
  }
  
  const lowerQuery = query.toLowerCase();
  
  // 递归过滤函数
  const filterRecursive = (items: TreeItem[]): TreeItem[] => {
    const result: TreeItem[] = [];
    
    for (const item of items) {
      // 先递归过滤子节点
      const filteredChildren = item.children ? filterRecursive(item.children) : [];
      
      // 当前节点匹配条件：有匹配的子节点 OR 当前节点label匹配
      const hasMatchingChildren = filteredChildren.length > 0;
      const currentNodeMatches = item.label.toLowerCase().includes(lowerQuery);
      
      // 如果当前节点匹配或有匹配的子节点，则保留当前节点
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
