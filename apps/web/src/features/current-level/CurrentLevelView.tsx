/**
 * CurrentLevelView
 *
 * Displays direct children of the current folder.
 * - Folder items: rendered as cards/buttons, click to enter
 * - Tag items: rendered as chips/badges, click to toggle selection
 * 
 * Semantic Rule (enforced):
 * - isContainer(node) = node.kind === 'folder' ONLY
 * - Tags are always leaf nodes; if old data has tag with children, warn but don't allow enter
 * 
 * Runtime Rule Enforcement:
 * - excludedTagIds: Tags that are excluded by EXCLUDES rules
 * - These tags are hidden from the picker (not rendered)
 */

import { useMemo } from 'react';
import { Badge, Group, Text, Stack, Paper } from '@mantine/core';
import { Folder, Tag, ChevronRight } from 'lucide-react';
import type { NodeId, TaxonomyIndex, TagNode } from '@tagselector/tag-core';
import { getTagColorHex, getReadableTextColor, getOutlineTextColor } from '../../utils/tagColor';
import styles from './CurrentLevelView.module.css';

/**
 * Check if a node is a folder (can be navigated into).
 * ONLY folders are containers. Tags are always leaf nodes.
 */
function isFolder(node: TagNode): boolean {
  return node.kind === 'folder';
}

/**
 * Dev warning: detect tag with children (legacy/invalid data).
 * This should never happen with valid data.
 */
function warnIfTagHasChildren(
  node: TagNode,
  childrenOf: Map<NodeId | null, NodeId[]>
): void {
  if (node.kind === 'tag') {
    const children = childrenOf.get(node.id);
    if (children && children.length > 0) {
      console.warn(
        `[TagSelector] Invalid data: Tag "${node.label}" (id: ${node.id}) has ${children.length} children. ` +
        `Tags must be leaf nodes. This tag will be treated as a selectable tag, not a navigable container.`
      );
    }
  }
}

interface CurrentLevelViewProps {
  index: TaxonomyIndex;
  currentFolderId: NodeId | null;
  selectedIds: Set<NodeId>;
  /** Tags excluded by EXCLUDES rules - will be hidden */
  excludedTagIds?: Set<NodeId>;
  /** Tag ID to highlight (for search result click feedback) */
  highlightTagId?: NodeId;
  onEnterFolder: (folderId: NodeId) => void;
  onToggleTag: (tagId: NodeId) => void;
}

export function CurrentLevelView({
  index,
  currentFolderId,
  selectedIds,
  excludedTagIds = new Set(),
  highlightTagId,
  onEnterFolder,
  onToggleTag,
}: CurrentLevelViewProps) {
  // Get direct children of current folder
  const children = useMemo(() => {
    const childIds = index.childrenOf.get(currentFolderId) || [];
    return childIds
      .map((id) => index.byId.get(id))
      .filter(Boolean) as TagNode[];
  }, [index, currentFolderId]);

  // Separate folders and tags (folders only, tags include any tag even with children)
  const folders = useMemo(
    () => children.filter((node) => isFolder(node)),
    [children]
  );

  // Filter out excluded tags
  const tags = useMemo(() => {
    const allTags = children.filter((node) => !isFolder(node));
    // Filter out excluded tags
    return allTags.filter((tag) => !excludedTagIds.has(tag.id));
  }, [children, excludedTagIds]);

  // Count excluded tags for display
  const excludedCount = useMemo(() => {
    const allTags = children.filter((node) => !isFolder(node));
    return allTags.length - tags.length;
  }, [children, tags]);

  // Dev warning for legacy data: tag with children
  useMemo(() => {
    tags.forEach((node) => {
      warnIfTagHasChildren(node, index.childrenOf);
    });
  }, [tags, index.childrenOf]);

  if (children.length === 0) {
    return (
      <div className={styles.empty}>
        <Text c="dimmed" size="sm" fs="italic">
          此文件夹为空
        </Text>
      </div>
    );
  }

  return (
    <Stack gap="md" className={styles.container}>
      {/* Folders Section (only kind='folder') */}
      {folders.length > 0 && (
        <div>
          <Text size="xs" c="dimmed" mb="xs" tt="uppercase" fw={600}>
            子文件夹
          </Text>
          <div className={styles.folderGrid}>
            {folders.map((folder) => (
              <Paper
                key={folder.id}
                p="sm"
                withBorder
                className={styles.folderCard}
                onClick={() => onEnterFolder(folder.id)}
              >
                <Group gap="xs" wrap="nowrap">
                  <Folder size={16} className={styles.folderIcon} />
                  <Text size="sm" className={styles.folderLabel}>
                    {folder.label}
                  </Text>
                  <ChevronRight size={14} className={styles.chevron} />
                </Group>
              </Paper>
            ))}
          </div>
        </div>
      )}

      {/* Tags Section (all tags, including ones with children - they're still tags) */}
      {(tags.length > 0 || excludedCount > 0) && (
        <div>
          <Group gap="xs" mb="xs">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              标签
            </Text>
            {excludedCount > 0 && (
              <Text size="xs" c="orange" fs="italic">
                ({excludedCount} 个被规则隐藏)
              </Text>
            )}
          </Group>
          {tags.length > 0 ? (
            <div className={styles.tagGrid}>
              {tags.map((tag) => {
                const isSelected = selectedIds.has(tag.id);
                const isHighlighted = tag.id === highlightTagId;
                const hex = getTagColorHex(tag);
                // For filled variant: use readable text color based on background
                // For outline variant: use smart text color based on border color brightness
                const textColor = hex 
                  ? (isSelected ? getReadableTextColor(hex) : getOutlineTextColor(hex))
                  : undefined;
                
                // Build style based on color
                const badgeStyle = hex
                  ? isSelected
                    ? { backgroundColor: hex, borderColor: hex, color: textColor }
                    : { borderColor: hex, color: textColor }
                  : undefined;

                // Build Badge props conditionally - don't pass color prop when using custom color
                const badgeProps = hex
                  ? {
                      // No color prop when using custom color to avoid Mantine override
                      style: badgeStyle,
                    }
                  : {
                      color: isSelected ? 'blue' : 'gray',
                      style: badgeStyle,
                    };

                return (
                  <Badge
                    key={tag.id}
                    size="lg"
                    variant={isSelected ? 'filled' : 'outline'}
                    {...badgeProps}
                    className={`tag-badge ${styles.tagBadge} ${isHighlighted ? styles.tagBadgeHighlight : ''}`}
                    leftSection={<Tag size={14} />}
                    onClick={() => onToggleTag(tag.id)}
                  >
                    {tag.label}
                  </Badge>
                );
              })}
            </div>
          ) : (
            <Text size="sm" c="dimmed" fs="italic">
              所有标签已被规则隐藏
            </Text>
          )}
        </div>
      )}
    </Stack>
  );
}
