/**
 * RecommendationsPanel
 *
 * Compact horizontal bar displaying recommended tags.
 * 
 * Algorithm (non-editing mode only):
 * 1. For each selected tag, read its data.recommendedTagIds
 * 2. Merge into candidate set (with recommendation count)
 * 3. Filter: must exist, be tag, not in selectedIds
 * 4. Sort: by recommendation count (desc), then by taxonomy order (stable)
 * 5. Truncate to limit
 * 
 * Semantic Rule (enforced):
 * - ONLY kind === 'tag' items are shown
 * - Folders are never recommended
 * - Only shown in non-editing mode
 */

import { useMemo } from 'react';
import { Badge, Text, Group } from '@mantine/core';
import { Sparkles, Tag } from 'lucide-react';
import type { NodeId, TaxonomyIndex, TagNode } from '@tagselector/tag-core';
import type { RecommendationsConfig } from '../../types/project-pack';
import { getTagDisplayLabel } from '../../utils/searchMatch';
import { useSettingsStore } from '../../store';
import styles from './RecommendationsPanel.module.css';
import { devWarn as loggerDevWarn } from '../../utils/logger';

interface RecommendationsPanelProps {
  index: TaxonomyIndex;
  currentFolderId: NodeId | null;
  recentPickedTagIds: NodeId[];
  recommendationsConfig: RecommendationsConfig;
  selectedIds: Set<NodeId>;
  onToggleTag: (tagId: NodeId) => void;
}

const DEFAULT_LIMIT = 12;

/**
 * Compare two sortPaths lexicographically.
 * Used for secondary sorting by taxonomy order.
 */
function compareSortPaths(pathA: number[], pathB: number[]): number {
  const minLen = Math.min(pathA.length, pathB.length);
  for (let i = 0; i < minLen; i++) {
    if (pathA[i] !== pathB[i]) {
      return pathA[i] - pathB[i];
    }
  }
  return pathA.length - pathB.length;
}

/**
 * Get recommendedTagIds from a tag node's data field.
 */
function getRecommendedTagIds(node: TagNode): NodeId[] {
  const nodeWithData = node as TagNode & {
    data?: { recommendedTagIds?: string[] };
  };
  const recommendedTagIds = nodeWithData.data?.recommendedTagIds;
  if (!Array.isArray(recommendedTagIds)) {
    return [];
  }
  return recommendedTagIds.filter((id): id is NodeId => typeof id === 'string');
}

export function RecommendationsPanel({
  index,
  currentFolderId,
  recentPickedTagIds,
  recommendationsConfig,
  selectedIds,
  onToggleTag,
}: RecommendationsPanelProps) {
  const { uiLanguage, isEditing } = useSettingsStore();
  
  // Check if any selected tag has recommendations configured
  const hasAnyRecommendationsConfigured = useMemo(() => {
    for (const selectedId of selectedIds) {
      const selectedNode = index.byId.get(selectedId);
      if (!selectedNode || selectedNode.kind !== 'tag') {
        continue;
      }
      const recommendedIds = getRecommendedTagIds(selectedNode);
      if (recommendedIds.length > 0) {
        return true;
      }
    }
    return false;
  }, [index, selectedIds]);
  
  const recommendations = useMemo(() => {
    // Only show recommendations in non-editing mode
    if (isEditing) {
      return [];
    }

    // Step 1: Collect recommendations from all selected tags
    const recommendationCounts = new Map<NodeId, number>();
    
    for (const selectedId of selectedIds) {
      const selectedNode = index.byId.get(selectedId);
      if (!selectedNode || selectedNode.kind !== 'tag') {
        continue;
      }
      
      const recommendedIds = getRecommendedTagIds(selectedNode);
      for (const recommendedId of recommendedIds) {
        // Skip if recommended tag is already selected (don't recommend selected tags)
        if (selectedIds.has(recommendedId)) {
          continue;
        }
        
        // Check if recommended tag exists and is a tag
        const recommendedNode = index.byId.get(recommendedId);
        if (!recommendedNode || recommendedNode.kind !== 'tag') {
          continue;
        }
        
        // Increment recommendation count
        recommendationCounts.set(
          recommendedId,
          (recommendationCounts.get(recommendedId) || 0) + 1
        );
      }
    }

    // Step 2: Convert to array and sort
    const limit = recommendationsConfig.limit ?? DEFAULT_LIMIT;
    const candidates: Array<{ node: TagNode; count: number; sortPath: number[] }> = [];
    
    for (const [tagId, count] of recommendationCounts) {
      const node = index.byId.get(tagId)!;
      const sortPath = index.sortPathCache.get(tagId);
      if (!sortPath) {
        loggerDevWarn(`[RecommendationsPanel] Missing sortPath for tag ${tagId}`);
        continue;
      }
      candidates.push({ node, count, sortPath });
    }

    // Step 3: Sort by count (desc), then by sortPath (stable order)
    candidates.sort((a, b) => {
      // Primary: recommendation count (descending)
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      // Secondary: taxonomy order (stable)
      return compareSortPaths(a.sortPath, b.sortPath);
    });

    // Step 4: Truncate to limit
    return candidates.slice(0, limit).map((c) => c.node);
  }, [index, selectedIds, recommendationsConfig, isEditing]);

  // Determine empty state message
  const emptyStateMessage = useMemo(() => {
    if (isEditing) {
      return uiLanguage === 'zh' ? '编辑模式' : 'Editing Mode';
    }
    if (selectedIds.size === 0) {
      return uiLanguage === 'zh' ? '选择标签后显示推荐' : 'Select tags to see recommendations';
    }
    if (!hasAnyRecommendationsConfigured) {
      return uiLanguage === 'zh' ? '该标签尚未配置推荐标签（编辑模式可添加）' : 'No recommendations configured for selected tags (add in editing mode)';
    }
    // Has recommendations configured but none available (all already selected or invalid)
    return uiLanguage === 'zh' ? '所有推荐标签已选择' : 'All recommended tags are already selected';
  }, [isEditing, selectedIds.size, hasAnyRecommendationsConfigured, uiLanguage]);

  // Render empty state if no recommendations
  if (recommendations.length === 0) {
    // In editing mode, show prominent red warning
    if (isEditing) {
      return (
        <div className={`${styles.compactBar} ${styles.editingModeBar}`}>
          <Group gap="xs" align="center" wrap="nowrap" className={styles.barHeader}>
            <Sparkles size={14} className={styles.editingModeIcon} />
            <Text size="sm" fw={700} c="red">
              {uiLanguage === 'zh' ? '编辑模式' : 'Editing Mode'}
            </Text>
          </Group>
          <div className={styles.emptyMessage}>
            <Text size="sm" fw={500} c="red">
              {uiLanguage === 'zh' ? '正在编辑模式 - 点击标签进行编辑' : 'Editing Mode - Click tags to edit'}
            </Text>
          </div>
        </div>
      );
    }
    
    // Non-editing empty states
    return (
      <div className={styles.compactBar}>
        <Group gap="xs" align="center" wrap="nowrap" className={styles.barHeader}>
          <Sparkles size={14} className={styles.sparkleIcon} />
          <Text size="sm" fw={600}>
            {uiLanguage === 'zh' ? '推荐' : 'Recommended'}
          </Text>
        </Group>
        <div className={styles.emptyMessage}>
          <Text size="sm" c="dimmed" fs="italic">
            {emptyStateMessage}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.compactBar}>
      <Group gap="xs" align="center" wrap="nowrap" className={styles.barHeader}>
        <Sparkles size={14} className={styles.sparkleIcon} />
        <Text size="sm" fw={600}>
          {uiLanguage === 'zh' ? '推荐' : 'Recommended'}
        </Text>
      </Group>
      <div className={styles.chipsRow}>
        {recommendations.map((tag) => (
          <Badge
            key={tag.id}
            size="lg"
            variant="light"
            color="teal"
            className={`tag-badge ${styles.chip}`}
            leftSection={<Tag size={16} />}
            onClick={() => onToggleTag(tag.id)}
          >
            {getTagDisplayLabel(tag)}
          </Badge>
        ))}
      </div>
    </div>
  );
}
