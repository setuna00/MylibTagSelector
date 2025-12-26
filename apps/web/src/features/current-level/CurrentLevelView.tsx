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
import { Badge, Group, Text, Stack, Paper, ActionIcon } from '@mantine/core';
import { Folder, Tag, ChevronRight, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import type { NodeId, TaxonomyIndex, TagNode } from '@tagselector/tag-core';
import { getTagColorHex, getReadableTextColor, getOutlineTextColor } from '../../utils/tagColor';
import { getTagDisplayLabel } from '../../utils/searchMatch';
import { useTaxonomyStore, useSelectionStore, useSettingsStore, useRulesStore } from '../../store';
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
  /** Whether in editing mode (shows order controls) */
  isEditing?: boolean;
  onEnterFolder: (folderId: NodeId) => void;
  onToggleTag: (tagId: NodeId) => void;
}

export function CurrentLevelView({
  index,
  currentFolderId,
  selectedIds,
  excludedTagIds = new Set(),
  highlightTagId,
  isEditing = false,
  onEnterFolder,
  onToggleTag,
}: CurrentLevelViewProps) {
  const { swapNodeOrder, deleteNode } = useTaxonomyStore();
  const { deselect } = useSelectionStore();
  const { uiLanguage } = useSettingsStore();
  const { cleanupInvalidRules } = useRulesStore();

  const handleDeleteNode = (nodeId: NodeId, nodeLabel: string) => {
    const node = index.byId.get(nodeId);
    if (!node) return;

    // Confirm deletion
    const confirmMessage = uiLanguage === 'zh' 
      ? `确定要删除"${nodeLabel}"吗？${node.kind === 'folder' ? '（文件夹必须为空）' : ''}`
      : `Are you sure you want to delete "${nodeLabel}"?${node.kind === 'folder' ? ' (Folder must be empty)' : ''}`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    const result = deleteNode(nodeId);
    
    if (result.success) {
      // Clean up selectedIds for removed tags
      for (const tagId of result.removedTagIds) {
        deselect(tagId);
      }
      
      // Clean up rules (triggerTagId and targetTagIds that reference deleted tags)
      // Get fresh index after deletion (it's already updated in deleteNode)
      const freshIndex = useTaxonomyStore.getState().index;
      cleanupInvalidRules(freshIndex);
      
      // Build success message with reference cleanup info
      let successMessage: string;
      if (result.cleanedReferenceCount > 0) {
        successMessage = uiLanguage === 'zh' 
          ? `已删除"${nodeLabel}"，已清理 ${result.cleanedReferenceCount} 处引用`
          : `Deleted "${nodeLabel}", cleaned ${result.cleanedReferenceCount} reference(s)`;
      } else {
        successMessage = uiLanguage === 'zh' 
          ? `已删除"${nodeLabel}"`
          : `Deleted "${nodeLabel}"`;
      }
      
      notifications.show({
        message: successMessage,
        color: 'green',
        autoClose: 3000,
      });
    } else {
      let errorMessage: string;
      if (result.reason === 'folder_not_empty') {
        errorMessage = uiLanguage === 'zh' 
          ? '无法删除：文件夹不为空，请先清空文件夹'
          : 'Cannot delete: Folder is not empty, please empty it first';
      } else {
        errorMessage = uiLanguage === 'zh' 
          ? '删除失败：节点未找到'
          : 'Delete failed: Node not found';
      }
      notifications.show({
        message: errorMessage,
        color: 'red',
        autoClose: 3000,
      });
    }
  };
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
            {folders.map((folder, index) => {
              const canMoveUp = index > 0;
              const canMoveDown = index < folders.length - 1;
              
              return (
                <Paper
                  key={folder.id}
                  p="sm"
                  withBorder
                  className={styles.folderCard}
                  onClick={() => onEnterFolder(folder.id)}
                >
                  <Group gap="xs" wrap="nowrap" justify="space-between">
                    <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
                      <Folder size={16} className={styles.folderIcon} />
                      <Text size="sm" className={styles.folderLabel}>
                        {folder.label}
                      </Text>
                      <ChevronRight size={14} className={styles.chevron} />
                    </Group>
                    {isEditing && (
                      <Group gap={4} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          disabled={!canMoveUp}
                          onClick={() => swapNodeOrder(folder.id, 'up')}
                          title="上移"
                        >
                          <ArrowUp size={14} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          disabled={!canMoveDown}
                          onClick={() => swapNodeOrder(folder.id, 'down')}
                          title="下移"
                        >
                          <ArrowDown size={14} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteNode(folder.id, folder.label)}
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Group>
                    )}
                  </Group>
                </Paper>
              );
            })}
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
              {tags.map((tag, index) => {
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

                // Get display label: use displayName if available, fallback to label
                const displayLabel = getTagDisplayLabel(tag);
                
                const canMoveUp = index > 0;
                const canMoveDown = index < tags.length - 1;

                // Merge badge style with flex style
                const finalStyle = badgeStyle ? { ...badgeStyle, flex: 1 } : { flex: 1 };

                return (
                  <Group key={tag.id} gap="xs" wrap="nowrap" align="center">
                    <Badge
                      size="lg"
                      variant={isSelected ? 'filled' : 'outline'}
                      {...(hex ? {} : { color: isSelected ? 'blue' : 'gray' })}
                      className={`tag-badge ${styles.tagBadge} ${isHighlighted ? styles.tagBadgeHighlight : ''}`}
                      leftSection={<Tag size={14} />}
                      onClick={() => onToggleTag(tag.id)}
                      style={finalStyle}
                    >
                      {displayLabel}
                    </Badge>
                    {isEditing && (
                      <Group gap={4} wrap="nowrap">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          disabled={!canMoveUp}
                          onClick={(e) => {
                            e.stopPropagation();
                            swapNodeOrder(tag.id, 'up');
                          }}
                          title="上移"
                        >
                          <ArrowUp size={14} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          disabled={!canMoveDown}
                          onClick={(e) => {
                            e.stopPropagation();
                            swapNodeOrder(tag.id, 'down');
                          }}
                          title="下移"
                        >
                          <ArrowDown size={14} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNode(tag.id, displayLabel);
                          }}
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Group>
                    )}
                  </Group>
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
