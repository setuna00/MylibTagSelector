/**
 * RecommendationsPanel
 *
 * Compact horizontal bar displaying recommended tags.
 * 
 * Algorithm (priority order):
 * 1. Seeds from recentPickedTagIds (most recent first)
 * 2. For each seed, append recommendationsConfig.map[seed] candidates (dedupe)
 * 3. Filter: must exist, be tag, not selected
 * 4. Truncate to limit
 * 5. If not enough: fallback to siblings/currentFolder tags
 * 
 * Semantic Rule (enforced):
 * - ONLY kind === 'tag' items are shown
 * - Folders are never recommended
 */

import { useMemo } from 'react';
import { Badge, Text, Group } from '@mantine/core';
import { Sparkles, Tag } from 'lucide-react';
import type { NodeId, TaxonomyIndex, TagNode } from '@tagselector/tag-core';
import type { RecommendationsConfig } from '../../types/project-pack';
import styles from './RecommendationsPanel.module.css';

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
 * Check if a node is a valid tag for recommendation.
 */
function isValidTag(index: TaxonomyIndex, nodeId: NodeId): boolean {
  const node = index.byId.get(nodeId);
  return !!node && node.kind === 'tag';
}

/**
 * Get sibling tags (fallback source).
 */
function getSiblingTags(
  index: TaxonomyIndex,
  parentId: NodeId | null,
  selectedIds: Set<NodeId>,
  seen: Set<NodeId>
): TagNode[] {
  const childIds = index.childrenOf.get(parentId) || [];
  return childIds
    .map((id) => index.byId.get(id))
    .filter((node): node is TagNode => 
      !!node && 
      node.kind === 'tag' && 
      !selectedIds.has(node.id) &&
      !seen.has(node.id)
    );
}

export function RecommendationsPanel({
  index,
  currentFolderId,
  recentPickedTagIds,
  recommendationsConfig,
  selectedIds,
  onToggleTag,
}: RecommendationsPanelProps) {
  const recommendations = useMemo(() => {
    const limit = recommendationsConfig.limit ?? DEFAULT_LIMIT;
    const configMap = recommendationsConfig.map || {};
    const result: TagNode[] = [];
    const seen = new Set<NodeId>();

    // Step 1-3: Process seeds from recentPickedTagIds
    for (const seed of recentPickedTagIds) {
      const candidates = configMap[seed] || [];
      for (const candidateId of candidates) {
        if (result.length >= limit) break;
        if (seen.has(candidateId)) continue;
        if (selectedIds.has(candidateId)) continue;
        if (!isValidTag(index, candidateId)) continue;

        const node = index.byId.get(candidateId)!;
        result.push(node);
        seen.add(candidateId);
      }
      if (result.length >= limit) break;
    }

    // Step 5: Fallback - siblings of recent picks, then currentFolder
    if (result.length < limit) {
      // First try siblings of recent picks
      for (const seed of recentPickedTagIds) {
        if (result.length >= limit) break;
        const seedNode = index.byId.get(seed);
        if (!seedNode) continue;
        
        const siblings = getSiblingTags(index, seedNode.parentId, selectedIds, seen);
        for (const sibling of siblings) {
          if (result.length >= limit) break;
          result.push(sibling);
          seen.add(sibling.id);
        }
      }
    }

    // Then try currentFolder children
    if (result.length < limit) {
      const folderTags = getSiblingTags(index, currentFolderId, selectedIds, seen);
      for (const tag of folderTags) {
        if (result.length >= limit) break;
        result.push(tag);
        seen.add(tag.id);
      }
    }

    return result;
  }, [index, currentFolderId, recentPickedTagIds, recommendationsConfig, selectedIds]);

  // Don't render if no recommendations
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className={styles.compactBar}>
      <Group gap="xs" align="center" wrap="nowrap" className={styles.barHeader}>
        <Sparkles size={14} className={styles.sparkleIcon} />
        <Text size="sm" fw={600}>
          推荐
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
            {tag.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
