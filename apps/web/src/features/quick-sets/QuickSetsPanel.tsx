/**
 * QuickSetsPanel (Quick Trees / 快捷分类)
 *
 * Renders user-defined quick trees from taxonomy.meta.extensions.quickTrees.
 * Each tree is a collapsible section containing groups and refs.
 * 
 * Click behavior:
 * - QuickTreeNode.type === 'group': virtual group (expand/collapse), renders children recursively
 * - QuickTreeNode.type === 'ref': references a taxonomy node
 *   - If refId not found: console.warn + skip rendering
 *   - If kind === 'folder': navigate to folder
 *   - If kind === 'tag': toggle selection
 * 
 * Features:
 * - Edit button opens QuickSetsEditorModal for CRUD operations
 */

import { useState, useCallback } from 'react';
import { Paper, Badge, Stack, Collapse, Group, ActionIcon, Text, Button, TextInput } from '@mantine/core';
import { ChevronDown, ChevronRight, Folder, Tag, Layers, Settings, Edit2, Plus, Check, X } from 'lucide-react';
import type { NodeId, TaxonomyIndex, Taxonomy } from '@tagselector/tag-core';
import type { QuickTree, QuickTreeNode } from '../../types/project-pack';
import { QuickSetsEditorModal } from './QuickSetsEditorModal';
import { useQuickSetEditSession } from './quicksetEditSession';
import { useSettingsStore } from '../../store';
import styles from './QuickSetsPanel.module.css';

// Avoid spamming console with the same invalid-ref warning on every render.
const warnedInvalidRefIds = new Set<string>();

interface QuickSetsPanelProps {
  quickTrees: QuickTree[];
  taxonomy: Taxonomy;
  index: TaxonomyIndex;
  currentFolderId: NodeId | null;
  selectedIds: Set<NodeId>;
  onNavigateToFolder: (folderId: NodeId | null) => void;
  onToggleTag: (tagId: NodeId) => void;
}

/**
 * Render a single QuickTreeNode recursively.
 */
function QuickTreeNodeRenderer({
  node,
  treeId,
  pathKey,
  index,
  currentFolderId,
  selectedIds,
  expandedGroups,
  onToggleGroup,
  onNavigateToFolder,
  onToggleTag,
}: {
  node: QuickTreeNode;
  treeId: string;
  pathKey: string;
  index: TaxonomyIndex;
  currentFolderId: NodeId | null;
  selectedIds: Set<NodeId>;
  expandedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  onNavigateToFolder: (folderId: NodeId | null) => void;
  onToggleTag: (tagId: NodeId) => void;
}) {
  if (node.type === 'group') {
    const groupKey = `${treeId}:${pathKey}:${node.id}`;
    const isExpanded = expandedGroups.has(groupKey);

    return (
      <div style={{ marginLeft: pathKey ? 12 : 0 }}>
        <Group
          gap="xs"
          className={styles.setHeader}
          onClick={() => onToggleGroup(groupKey)}
        >
          <ActionIcon variant="subtle" size="sm">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </ActionIcon>
          <Text size="sm" fw={500}>{node.label}</Text>
        </Group>
        <Collapse in={isExpanded}>
          <div style={{ paddingLeft: 8 }}>
            {node.children.map((child, idx) => (
              <QuickTreeNodeRenderer
                key={child.type === 'group' ? child.id : `ref-${idx}`}
                node={child}
                treeId={treeId}
                pathKey={`${pathKey}:${node.id}`}
                index={index}
                currentFolderId={currentFolderId}
                selectedIds={selectedIds}
                expandedGroups={expandedGroups}
                onToggleGroup={onToggleGroup}
                onNavigateToFolder={onNavigateToFolder}
                onToggleTag={onToggleTag}
              />
            ))}
          </div>
        </Collapse>
      </div>
    );
  }

  // type === 'ref'
  const refNode = index.byId.get(node.refId);
  if (!refNode) {
    const refId = String(node.refId);
    if (!warnedInvalidRefIds.has(refId)) {
      warnedInvalidRefIds.add(refId);
      console.warn(
        `[QuickSetsPanel] Invalid ref: refId "${refId}" not found in taxonomy. Skipping.`
      );
    }
    return null;
  }

  const isFolder = refNode.kind === 'folder';
  const isSelected = selectedIds.has(refNode.id);
  const isCurrent = currentFolderId === refNode.id;

  const handleClick = () => {
    if (isFolder) {
      onNavigateToFolder(refNode.id);
    } else {
      onToggleTag(refNode.id);
    }
  };

  return (
    <Badge
      size="lg"
      variant={isFolder ? (isCurrent ? 'filled' : 'light') : (isSelected ? 'filled' : 'outline')}
      color={isFolder ? 'blue' : (isSelected ? 'green' : 'gray')}
      className={`tag-badge ${styles.itemBadge}`}
      leftSection={isFolder ? <Folder size={16} /> : <Tag size={16} />}
      onClick={handleClick}
      style={{ marginRight: 4, marginBottom: 4 }}
    >
      {refNode.label}
    </Badge>
  );
}

export function QuickSetsPanel({
  quickTrees,
  taxonomy,
  index,
  currentFolderId,
  selectedIds,
  onNavigateToFolder,
  onToggleTag,
}: QuickSetsPanelProps) {
  const { uiLanguage } = useSettingsStore();
  // Track expanded state: tree-level and group-level
  const [expandedTrees, setExpandedTrees] = useState<Set<string>>(() => {
    // Default: expand first tree if exists
    if (quickTrees.length > 0) {
      return new Set([quickTrees[0].id]);
    }
    return new Set();
  });

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  // Editor modal state (legacy modal editor)
  const [editorOpen, setEditorOpen] = useState(false);

  // New QuickSet creation state
  const [showNewQuickSetInput, setShowNewQuickSetInput] = useState(false);
  const [newQuickSetName, setNewQuickSetName] = useState('');

  // Get edit session actions
  const { isEditing, initDraftFromTaxonomy, enterEditMode, createQuickSet } = useQuickSetEditSession();

  const toggleTree = useCallback((treeId: string) => {
    setExpandedTrees((prev) => {
      const next = new Set(prev);
      if (next.has(treeId)) {
        next.delete(treeId);
      } else {
        next.add(treeId);
      }
      return next;
    });
  }, []);

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  // Handle entering edit mode for a QuickSet
  const handleEnterEditMode = useCallback((treeId: string) => {
    // Initialize draft from current taxonomy and enter edit mode
    initDraftFromTaxonomy(treeId);
  }, [initDraftFromTaxonomy]);

  // Handle creating a new QuickSet
  const handleCreateNewQuickSet = useCallback(() => {
    const name = newQuickSetName.trim();
    if (!name) return;

    // First init draft if needed, then create and enter edit mode
    initDraftFromTaxonomy();
    // Use setTimeout to ensure draft is initialized first
    setTimeout(() => {
      createQuickSet(name);
    }, 0);
    
    setNewQuickSetName('');
    setShowNewQuickSetInput(false);
  }, [newQuickSetName, initDraftFromTaxonomy, createQuickSet]);

  // Header section (shared between empty and non-empty states)
  const headerSection = (
      <Group gap="xs" mb="xs" justify="space-between">
        <Group gap="xs">
          <Layers size={14} className={styles.starIcon} />
          <Text size="sm" fw={600}>
            {uiLanguage === 'zh' ? '快捷分类' : 'Quick Categories'}
          </Text>
          {isEditing && (
            <Badge size="xs" color="blue" variant="light">
              {uiLanguage === 'zh' ? '编辑中' : 'Editing'}
            </Badge>
          )}
        </Group>
        <Group gap="xs">
          {/* New QuickSet button */}
          {showNewQuickSetInput ? (
            <Group gap="xs" wrap="nowrap">
              <TextInput
                size="xs"
                placeholder={uiLanguage === 'zh' ? '名称...' : 'Name...'}
                value={newQuickSetName}
                onChange={(e) => setNewQuickSetName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateNewQuickSet();
                  if (e.key === 'Escape') {
                    setShowNewQuickSetInput(false);
                    setNewQuickSetName('');
                  }
                }}
                autoFocus
                style={{ width: 100 }}
              />
              <ActionIcon
                size="sm"
                variant="subtle"
                color="green"
                onClick={handleCreateNewQuickSet}
                disabled={!newQuickSetName.trim()}
              >
                <Check size={14} />
              </ActionIcon>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={() => {
                  setShowNewQuickSetInput(false);
                  setNewQuickSetName('');
                }}
              >
                <X size={14} />
              </ActionIcon>
            </Group>
          ) : (
            <ActionIcon
              size="sm"
              variant="light"
              color="blue"
              onClick={() => setShowNewQuickSetInput(true)}
              title={uiLanguage === 'zh' ? '新建快捷分类' : 'New Quick Category'}
            >
              <Plus size={14} />
            </ActionIcon>
          )}
          <Button
            size="xs"
            variant="light"
            leftSection={<Settings size={12} />}
            onClick={() => setEditorOpen(true)}
          >
            {uiLanguage === 'zh' ? '高级' : 'Advanced'}
          </Button>
        </Group>
      </Group>
  );

  // Empty state: no quickTrees configured
  if (quickTrees.length === 0) {
    return (
      <Paper p="sm" withBorder className={styles.container}>
        {headerSection}
        <Text size="xs" c="dimmed">
          {uiLanguage === 'zh' ? '暂无快捷分类，点击 + 创建' : 'No quick categories, click + to create'}
        </Text>

        <QuickSetsEditorModal
          opened={editorOpen}
          onClose={() => setEditorOpen(false)}
          quickTrees={quickTrees}
          taxonomy={taxonomy}
          index={index}
          currentFolderId={currentFolderId}
          selectedIds={selectedIds}
        />
      </Paper>
    );
  }

  return (
    <Paper p="sm" withBorder className={styles.container}>
      {headerSection}

      <Stack gap="xs">
        {quickTrees.map((tree: QuickTree) => (
          <div key={tree.id} className={styles.setGroup}>
            <Group
              gap="xs"
              className={styles.setHeader}
              wrap="nowrap"
            >
              <Group
                gap="xs"
                style={{ flex: 1, cursor: 'pointer' }}
                onClick={() => toggleTree(tree.id)}
              >
                <ActionIcon variant="subtle" size="sm">
                  {expandedTrees.has(tree.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </ActionIcon>
                <Text size="sm" fw={500}>{tree.name}</Text>
              </Group>
              {/* Edit button for this QuickSet */}
              <ActionIcon
                size="sm"
                variant="subtle"
                color="blue"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnterEditMode(tree.id);
                }}
                title={uiLanguage === 'zh' ? `编辑 ${tree.name}` : `Edit ${tree.name}`}
              >
                <Edit2 size={14} />
              </ActionIcon>
            </Group>

            <Collapse in={expandedTrees.has(tree.id)}>
              <div className={styles.itemsGrid}>
                {tree.roots.map((node, idx) => (
                  <QuickTreeNodeRenderer
                    key={node.type === 'group' ? node.id : `ref-${idx}`}
                    node={node}
                    treeId={tree.id}
                    pathKey=""
                    index={index}
                    currentFolderId={currentFolderId}
                    selectedIds={selectedIds}
                    expandedGroups={expandedGroups}
                    onToggleGroup={toggleGroup}
                    onNavigateToFolder={onNavigateToFolder}
                    onToggleTag={onToggleTag}
                  />
                ))}
              </div>
            </Collapse>
          </div>
        ))}
      </Stack>

      <QuickSetsEditorModal
        opened={editorOpen}
        onClose={() => setEditorOpen(false)}
        quickTrees={quickTrees}
        taxonomy={taxonomy}
        index={index}
        currentFolderId={currentFolderId}
        selectedIds={selectedIds}
      />
    </Paper>
  );
}
