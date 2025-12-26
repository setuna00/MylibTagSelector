/**
 * QuickSetsEditorModal
 *
 * Modal for editing QuickSets (QuickTrees).
 * Uses draft state internally; only writes to taxonomy on Save.
 *
 * MVP Features:
 * - List all QuickSets
 * - Create / Rename / Delete QuickSet
 * - View refs in a QuickSet
 * - Add current folder as ref
 * - Add selected tags as refs (batch, dedupe)
 * - Delete individual refs
 * - Save / Cancel
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  TextInput,
  ActionIcon,
  Text,
  Paper,
  Badge,
  Divider,
  ScrollArea,
} from '@mantine/core';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Folder,
  Tag,
  ArrowLeft,
  FolderPlus,
  Tags,
} from 'lucide-react';
import type { NodeId, TaxonomyIndex, Taxonomy } from '@tagselector/tag-core';
import type { QuickTree, QuickTreeNode } from '../../types/project-pack';
import { injectExtensions } from '../../utils/extensions';
import { useTaxonomyStore, useSettingsStore } from '../../store';

interface QuickSetsEditorModalProps {
  opened: boolean;
  onClose: () => void;
  quickTrees: QuickTree[];
  taxonomy: Taxonomy;
  index: TaxonomyIndex;
  currentFolderId: NodeId | null;
  selectedIds: Set<NodeId>;
}

/**
 * Generate a unique ID for new QuickSets.
 */
function generateId(): string {
  return `qs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function QuickSetsEditorModal({
  opened,
  onClose,
  quickTrees,
  taxonomy,
  index,
  currentFolderId,
  selectedIds,
}: QuickSetsEditorModalProps) {
  const { setTaxonomy } = useTaxonomyStore();
  const { uiLanguage } = useSettingsStore();

  // Draft state - deep copy of quickTrees
  const [draftTrees, setDraftTrees] = useState<QuickTree[]>(() =>
    JSON.parse(JSON.stringify(quickTrees))
  );

  // Reset draft when modal opens with new data
  const resetDraft = useCallback(() => {
    setDraftTrees(JSON.parse(JSON.stringify(quickTrees)));
    setSelectedTreeId(null);
    setEditingId(null);
    setEditingName('');
    setNewSetName('');
  }, [quickTrees]);

  // Which QuickSet is currently being viewed/edited (for refs)
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);

  // Which QuickSet name is being edited inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // New QuickSet name input
  const [newSetName, setNewSetName] = useState('');

  // Get the selected tree
  const selectedTree = useMemo(
    () => draftTrees.find((t) => t.id === selectedTreeId) ?? null,
    [draftTrees, selectedTreeId]
  );

  // Get selected tags only (filter out folders)
  const selectedTagIds = useMemo(() => {
    const tags: NodeId[] = [];
    for (const id of selectedIds) {
      const node = index.byId.get(id);
      if (node && node.kind === 'tag') {
        tags.push(id);
      }
    }
    return tags;
  }, [selectedIds, index]);

  // ========================================================================
  // QuickSet CRUD
  // ========================================================================

  const handleCreateSet = useCallback(() => {
    const name = newSetName.trim();
    if (!name) return;

    const newTree: QuickTree = {
      id: generateId(),
      name,
      roots: [],
    };

    setDraftTrees((prev) => [...prev, newTree]);
    setNewSetName('');
  }, [newSetName]);

  const handleDeleteSet = useCallback((treeId: string) => {
    setDraftTrees((prev) => prev.filter((t) => t.id !== treeId));
    if (selectedTreeId === treeId) {
      setSelectedTreeId(null);
    }
  }, [selectedTreeId]);

  const handleStartRename = useCallback((tree: QuickTree) => {
    setEditingId(tree.id);
    setEditingName(tree.name);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      setEditingName('');
      return;
    }

    setDraftTrees((prev) =>
      prev.map((t) => (t.id === editingId ? { ...t, name } : t))
    );
    setEditingId(null);
    setEditingName('');
  }, [editingId, editingName]);

  const handleCancelRename = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

  // ========================================================================
  // Ref operations
  // ========================================================================

  /**
   * Add a ref to the selected tree (deduped).
   */
  const addRef = useCallback(
    (refId: NodeId) => {
      if (!selectedTreeId) return;

      setDraftTrees((prev) =>
        prev.map((t) => {
          if (t.id !== selectedTreeId) return t;

          // Check for existing ref (shallow check on roots)
          const exists = t.roots.some(
            (n) => n.type === 'ref' && n.refId === refId
          );
          if (exists) return t;

          const newRef: QuickTreeNode = { type: 'ref', refId };
          return { ...t, roots: [...t.roots, newRef] };
        })
      );
    },
    [selectedTreeId]
  );

  /**
   * Remove a ref from the selected tree by index.
   */
  const removeRef = useCallback(
    (refIndex: number) => {
      if (!selectedTreeId) return;

      setDraftTrees((prev) =>
        prev.map((t) => {
          if (t.id !== selectedTreeId) return t;
          const newRoots = [...t.roots];
          newRoots.splice(refIndex, 1);
          return { ...t, roots: newRoots };
        })
      );
    },
    [selectedTreeId]
  );

  const handleAddCurrentFolder = useCallback(() => {
    if (currentFolderId) {
      addRef(currentFolderId);
    }
  }, [currentFolderId, addRef]);

  const handleAddSelectedTags = useCallback(() => {
    for (const tagId of selectedTagIds) {
      addRef(tagId);
    }
  }, [selectedTagIds, addRef]);

  // ========================================================================
  // Save / Cancel
  // ========================================================================

  const handleSave = useCallback(() => {
    // Inject updated quickTrees into taxonomy
    const newTaxonomy = injectExtensions(taxonomy, { quickTrees: draftTrees });
    setTaxonomy(newTaxonomy);
    onClose();
  }, [taxonomy, draftTrees, setTaxonomy, onClose]);

  const handleCancel = useCallback(() => {
    // Discard draft and close
    resetDraft();
    onClose();
  }, [resetDraft, onClose]);

  // Reset draft when modal opens
  // Mantine Modal does not support `onOpen`; drive this from `opened`.
  useEffect(() => {
    if (opened) {
      resetDraft();
    }
  }, [opened, resetDraft]);

  // ========================================================================
  // Render helpers
  // ========================================================================

  /**
   * Render a ref node (show label from index or error state).
   */
  const renderRefNode = (node: QuickTreeNode, idx: number) => {
    if (node.type !== 'ref') return null;

    const refNode = index.byId.get(node.refId);
    const isFolder = refNode?.kind === 'folder';

    return (
      <Group key={`ref-${idx}`} gap="xs" wrap="nowrap">
        <Badge
          size="lg"
          variant={refNode ? 'light' : 'filled'}
          color={refNode ? (isFolder ? 'blue' : 'green') : 'red'}
          className="tag-badge"
          leftSection={
            refNode ? (
              isFolder ? (
                <Folder size={14} />
              ) : (
                <Tag size={14} />
              )
            ) : (
              <X size={14} />
            )
          }
          style={{ flex: 1 }}
        >
          {refNode ? refNode.label : `(无效: ${node.refId})`}
        </Badge>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="red"
          onClick={() => removeRef(idx)}
        >
          <Trash2 size={14} />
        </ActionIcon>
      </Group>
    );
  };

  // ========================================================================
  // Main render
  // ========================================================================

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title={
        <Group gap="xs">
          {selectedTree && (
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setSelectedTreeId(null)}
            >
              <ArrowLeft size={16} />
            </ActionIcon>
          )}
          <Text fw={600}>
            {selectedTree 
              ? (uiLanguage === 'zh' ? `编辑: ${selectedTree.name}` : `Edit: ${selectedTree.name}`)
              : (uiLanguage === 'zh' ? '快捷分类编辑器' : 'Quick Category Editor')}
          </Text>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="md">
        {!selectedTree ? (
          // ============================================================
          // QuickSet list view
          // ============================================================
          <>
            {/* Create new QuickSet */}
            <Group gap="xs">
              <TextInput
                placeholder={uiLanguage === 'zh' ? '新建快捷分类...' : 'New quick category...'}
                value={newSetName}
                onChange={(e) => setNewSetName(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSet()}
                style={{ flex: 1 }}
                size="sm"
              />
              <Button
                size="sm"
                leftSection={<Plus size={14} />}
                onClick={handleCreateSet}
                disabled={!newSetName.trim()}
              >
                {uiLanguage === 'zh' ? '创建' : 'Create'}
              </Button>
            </Group>

            <Divider />

            {/* List of QuickSets */}
            <ScrollArea.Autosize mah={300}>
              <Stack gap="xs">
                {draftTrees.length === 0 ? (
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    {uiLanguage === 'zh' ? '暂无快捷分类，请创建一个' : 'No quick categories, please create one'}
                  </Text>
                ) : (
                  draftTrees.map((tree) => (
                    <Paper key={tree.id} p="sm" withBorder>
                      <Group gap="xs" wrap="nowrap">
                        {editingId === tree.id ? (
                          // Editing name
                          <>
                            <TextInput
                              value={editingName}
                              onChange={(e) =>
                                setEditingName(e.currentTarget.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmRename();
                                if (e.key === 'Escape') handleCancelRename();
                              }}
                              size="xs"
                              style={{ flex: 1 }}
                              autoFocus
                            />
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="green"
                              onClick={handleConfirmRename}
                            >
                              <Check size={14} />
                            </ActionIcon>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="gray"
                              onClick={handleCancelRename}
                            >
                              <X size={14} />
                            </ActionIcon>
                          </>
                        ) : (
                          // Display name
                          <>
                            <Text
                              size="sm"
                              style={{ flex: 1, cursor: 'pointer' }}
                              onClick={() => setSelectedTreeId(tree.id)}
                            >
                              {tree.name}
                            </Text>
                            <Badge size="xs" variant="light" color="gray">
                              {uiLanguage === 'zh' ? `${tree.roots.length} 项` : `${tree.roots.length} items`}
                            </Badge>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              onClick={() => handleStartRename(tree)}
                            >
                              <Edit2 size={14} />
                            </ActionIcon>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              onClick={() => handleDeleteSet(tree.id)}
                            >
                              <Trash2 size={14} />
                            </ActionIcon>
                          </>
                        )}
                      </Group>
                    </Paper>
                  ))
                )}
              </Stack>
            </ScrollArea.Autosize>
          </>
        ) : (
          // ============================================================
          // Single QuickSet detail view (refs)
          // ============================================================
          <>
            {/* Add actions */}
            <Group gap="xs">
              <Button
                size="sm"
                variant="light"
                leftSection={<FolderPlus size={14} />}
                onClick={handleAddCurrentFolder}
                disabled={!currentFolderId}
              >
                {uiLanguage === 'zh' ? '添加当前文件夹' : 'Add Current Folder'}
              </Button>
              <Button
                size="sm"
                variant="light"
                leftSection={<Tags size={14} />}
                onClick={handleAddSelectedTags}
                disabled={selectedTagIds.length === 0}
              >
                {uiLanguage === 'zh' 
                  ? `添加已选标签 (${selectedTagIds.length})`
                  : `Add Selected Tags (${selectedTagIds.length})`}
              </Button>
            </Group>

            <Divider />

            {/* Refs list */}
            <ScrollArea.Autosize mah={300}>
              <Stack gap="xs">
                {selectedTree.roots.length === 0 ? (
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    {uiLanguage === 'zh' ? '暂无条目，请添加文件夹或标签' : 'No items, please add folders or tags'}
                  </Text>
                ) : (
                  selectedTree.roots.map((node, idx) => renderRefNode(node, idx))
                )}
              </Stack>
            </ScrollArea.Autosize>
          </>
        )}

        <Divider />

        {/* Save / Cancel */}
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={handleCancel}>
            {uiLanguage === 'zh' ? '取消' : 'Cancel'}
          </Button>
          <Button onClick={handleSave}>
            {uiLanguage === 'zh' ? '保存' : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

