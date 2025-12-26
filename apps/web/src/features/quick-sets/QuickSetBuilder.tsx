/**
 * QuickSetBuilder
 *
 * Bottom fixed area component shown during QuickSet editing mode.
 * Replaces the normal Selection + ExportPreview section completely.
 *
 * Features:
 * - Header: Shows QuickSet name + current folder breadcrumb + Save/Cancel buttons
 * - Breadcrumb: Clickable path from root to current folder
 * - Folder contents: List of folders and tags in current cursor folder
 * - Actions: Create new folder, etc.
 */

import { useState, useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  Button,
  ActionIcon,
  Badge,
  TextInput,
  ScrollArea,
  Divider,
} from '@mantine/core';
import {
  Save,
  X,
  FolderPlus,
  Folder,
  Tag,
  Trash2,
  Edit2,
  Check,
  ChevronRight,
  Home,
} from 'lucide-react';
import type { TaxonomyIndex } from '@tagselector/tag-core';
import { useQuickSetEditSession } from './quicksetEditSession';
import type { QSFolder, QSTag } from './types';
import styles from './QuickSetBuilder.module.css';

interface QuickSetBuilderProps {
  index: TaxonomyIndex;
  /** Callback to show a toast notification */
  onNotify?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
}

export function QuickSetBuilder({ index, onNotify }: QuickSetBuilderProps) {
  const {
    isEditing,
    dirty,
    migrationWarnings,
    cursorFolderId,
    saveAndExit,
    cancelEditing,
    navigateToFolder,
    navigateToRoot,
    getEditingQuickSet,
    getCurrentFolder,
    getBreadcrumbPath,
    createFolderInCurrentFolder,
    renameFolder,
    deleteFolder,
    isFolderEmpty,
    removeTagFromCurrentFolder,
  } = useQuickSetEditSession();

  // New folder name input
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  // Inline editing state for folder rename
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  const editingQuickSet = getEditingQuickSet();
  const currentFolder = getCurrentFolder();
  const breadcrumbPath = getBreadcrumbPath();

  // ========================================================================
  // Handlers
  // ========================================================================

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim();
    if (!name) return;

    createFolderInCurrentFolder(name);
    setNewFolderName('');
    setShowNewFolderInput(false);
  }, [newFolderName, createFolderInCurrentFolder]);

  const handleStartRename = useCallback((folder: QSFolder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (!editingFolderId) return;
    const name = editingFolderName.trim();
    if (name) {
      renameFolder(editingFolderId, name);
    }
    setEditingFolderId(null);
    setEditingFolderName('');
  }, [editingFolderId, editingFolderName, renameFolder]);

  const handleCancelRename = useCallback(() => {
    setEditingFolderId(null);
    setEditingFolderName('');
  }, []);

  const handleDeleteFolder = useCallback((folderId: string, folderName: string) => {
    const isEmpty = isFolderEmpty(folderId);
    
    if (!isEmpty) {
      // Show confirmation dialog
      const confirmed = window.confirm(
        `文件夹 "${folderName}" 不为空，确定要删除吗？\n删除后其中所有内容都会丢失。`
      );
      if (!confirmed) return;
    }

    deleteFolder(folderId, true);
  }, [isFolderEmpty, deleteFolder]);

  const handleRemoveTag = useCallback((tagId: string) => {
    removeTagFromCurrentFolder(tagId);
  }, [removeTagFromCurrentFolder]);

  const handleFolderClick = useCallback((e: React.MouseEvent, folderId: string) => {
    // Navigate to the folder
    navigateToFolder(folderId);
  }, [navigateToFolder]);

  const handleSave = useCallback(() => {
    saveAndExit();
    onNotify?.('QuickSet 已保存', 'success');
  }, [saveAndExit, onNotify]);

  const handleCancel = useCallback(() => {
    if (dirty) {
      const confirmed = window.confirm('确定要取消吗？所有未保存的更改将丢失。');
      if (!confirmed) return;
    }
    cancelEditing();
  }, [dirty, cancelEditing]);

  // ========================================================================
  // Not in editing mode
  // ========================================================================

  if (!isEditing || !editingQuickSet) {
    return null;
  }

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <Stack gap="sm" className={styles.container}>
      {/* Migration warnings */}
      {migrationWarnings.length > 0 && (
        <div className={styles.warningBar}>
          <Text size="xs" c="orange">
            ⚠️ 检测到旧格式数据，部分内容已自动转换或跳过
          </Text>
        </div>
      )}

      {/* Header */}
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" fw={600} className={styles.headerTitle}>
            正在编辑：{editingQuickSet.name}
          </Text>
          <Text size="sm" c="dimmed">·</Text>
          <Text size="sm" c="dimmed">
            当前位置：
          </Text>
          {/* Breadcrumb */}
          <Group gap={4} wrap="nowrap">
            {breadcrumbPath.map((item, idx) => (
              <Group key={item.id} gap={4} wrap="nowrap">
                {idx > 0 && <ChevronRight size={12} className={styles.breadcrumbSep} />}
                <Badge
                  size="lg"
                  variant={item.id === cursorFolderId ? 'filled' : 'light'}
                  color={item.id === 'root' ? 'blue' : 'gray'}
                  className={`tag-badge ${styles.breadcrumbItem}`}
                  leftSection={item.id === 'root' ? <Home size={14} /> : <Folder size={14} />}
                  onClick={() => navigateToFolder(item.id)}
                >
                  {item.id === 'root' ? '根目录' : item.name}
                </Badge>
              </Group>
            ))}
          </Group>
        </Group>

        {/* Action buttons */}
        <Group gap="xs" wrap="nowrap">
          {dirty && (
            <Badge size="xs" color="orange" variant="light">
              未保存
            </Badge>
          )}
          <Button
            size="xs"
            variant="light"
            color="gray"
            leftSection={<X size={14} />}
            onClick={handleCancel}
          >
            取消
          </Button>
          <Button
            size="xs"
            leftSection={<Save size={14} />}
            onClick={handleSave}
          >
            保存
          </Button>
        </Group>
      </Group>

      <Divider />

      {/* Actions row */}
      <Group gap="xs">
        {showNewFolderInput ? (
          <Group gap="xs" wrap="nowrap">
            <TextInput
              size="xs"
              placeholder="新文件夹名称..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                }
              }}
              autoFocus
              style={{ width: 150 }}
            />
            <ActionIcon
              size="sm"
              variant="subtle"
              color="green"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
            >
              <Check size={14} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => {
                setShowNewFolderInput(false);
                setNewFolderName('');
              }}
            >
              <X size={14} />
            </ActionIcon>
          </Group>
        ) : (
          <Button
            size="xs"
            variant="light"
            leftSection={<FolderPlus size={14} />}
            onClick={() => setShowNewFolderInput(true)}
          >
            新建文件夹
          </Button>
        )}

        <Text size="xs" c="dimmed" ml="auto">
          单击右侧主树中的标签可添加到当前文件夹
        </Text>
      </Group>

      <Divider />

      {/* Current folder contents */}
      <ScrollArea.Autosize mah={180}>
        <Stack gap="xs">
          {!currentFolder || currentFolder.children.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              当前文件夹为空，点击右侧标签添加，或创建子文件夹
            </Text>
          ) : (
            currentFolder.children.map((node) => {
              if (node.type === 'folder') {
                // Folder row
                const folder = node as QSFolder;
                const isEditing = editingFolderId === folder.id;

                return (
                  <Group
                    key={folder.id}
                    gap="xs"
                    wrap="nowrap"
                    className={styles.folderRow}
                    onClick={(e) => {
                      // Only navigate if not clicking on action buttons
                      if ((e.target as HTMLElement).closest('.action-button')) return;
                      if (!isEditing) {
                        handleFolderClick(e, folder.id);
                      }
                    }}
                  >
                    <Folder size={16} className={styles.folderIcon} />
                    {isEditing ? (
                      <>
                        <TextInput
                          size="xs"
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmRename();
                            if (e.key === 'Escape') handleCancelRename();
                          }}
                          autoFocus
                          style={{ flex: 1 }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="green"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmRename();
                          }}
                          className="action-button"
                        >
                          <Check size={14} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelRename();
                          }}
                          className="action-button"
                        >
                          <X size={14} />
                        </ActionIcon>
                      </>
                    ) : (
                      <>
                        <Text size="sm" style={{ flex: 1 }}>
                          {folder.name}
                        </Text>
                        <Badge size="xs" variant="light" color="gray">
                          {folder.children.length} 项
                        </Badge>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(folder);
                          }}
                          className="action-button"
                        >
                          <Edit2 size={14} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder.id, folder.name);
                          }}
                          className="action-button"
                        >
                          <Trash2 size={14} />
                        </ActionIcon>
                      </>
                    )}
                  </Group>
                );
              } else {
                // Tag row
                const tag = node as QSTag;
                const tagNode = index.byId.get(tag.tagId);
                const label = tag.displayNameOverride || tagNode?.label || `(无效: ${tag.tagId})`;
                const isValid = !!tagNode;

                return (
                  <Group key={tag.tagId} gap="xs" wrap="nowrap" className={styles.tagRow}>
                    <Tag size={16} className={styles.tagIcon} />
                    <Text
                      size="sm"
                      style={{ flex: 1 }}
                      c={isValid ? undefined : 'red'}
                    >
                      {label}
                    </Text>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={() => handleRemoveTag(tag.tagId)}
                    >
                      <Trash2 size={14} />
                    </ActionIcon>
                  </Group>
                );
              }
            })
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}

