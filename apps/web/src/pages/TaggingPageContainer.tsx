/**
 * TaggingPageContainer
 *
 * Business container component that:
 * - Reads from zustand stores
 * - Manages search query state
 * - Manages currentFolderId and recentPickedTagIds states
 * - Extracts extensions (quickTrees, recommendationsConfig) from taxonomy
 * - Handles sample taxonomy loading
 * - Triggers cleanup on index change
 * - Uses file operations hook
 * - Passes slots to AppShellLayout
 * - Enforces rules at runtime (when rules panel is closed)
 *
 * Phase 2 Layout:
 * - Left: FolderNavigator (folder-only tree for navigation)
 * - Right: CurrentLevelView (shows current folder's children for tag selection)
 * 
 * Navigation Invariant (enforced):
 * - currentFolderId can ONLY be null (Root) or a valid folder ID
 * - Navigation to a tag ID is rejected with console.warn
 * 
 * Runtime Rule Enforcement:
 * - REQUIRES: Auto-add missing targets to selection when a trigger is selected
 * - EXCLUDES: Pass excluded tag IDs to CurrentLevelView to hide/disable them
 * - When rules panel is open, enforcement is paused
 */

import { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { AppShell, Button, Group, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import type { NodeId, Taxonomy } from '@tagselector/tag-core';
import { SCHEMA_VERSION } from '@tagselector/tag-core';
import {
  useTaxonomyStore,
  useSelectionStore,
  useRulesStore,
  useSettingsStore,
  computeRequiredTags,
  computeExcludedTags,
} from '../store';
import { FolderNavigator } from '../features/taxonomy-tree';
import { ExportPreview } from '../features/export';
import { SearchBar, SearchResultsPanel } from '../features/search';
import { SelectionChips } from '../features/selection';
import { QuickSetsPanel, QuickSetBuilder, useQuickSetEditSession } from '../features/quick-sets';
import { CurrentLevelView, CurrentFolderHeader, TagEditDrawer } from '../features/current-level';
import { RecommendationsPanel } from '../features/recommendations';
import { RulesPanel, RulesToggleButton } from '../features/rules';
import { loadSampleTaxonomy } from '../data/loadSample';
import { useFileOperations } from '../hooks/useFileOperations';
import { AppShellLayout } from '../layout/AppShellLayout';
import { ValidationErrorBar, LanguageToggle, CreateNodeButtons } from '../shared/components';
import { getExtensions } from '../utils/extensions';
import { devWarn as loggerDevWarn, error as loggerError } from '../utils/logger';

export function TaggingPageContainer() {
  const {
    taxonomy,
    index,
    validationErrors,
    setTaxonomy,
    clearTaxonomy,
    clearValidationErrors,
    createNode,
  } = useTaxonomyStore();
  const { uiLanguage, isEditing } = useSettingsStore();
  const { selectedIds, toggle, select, clear, cleanupInvalidSelection, addMany } = useSelectionStore();
  const { cleanupInvalidRules, handleTagClick, isPanelOpen, savedRules } = useRulesStore();
  const {
    isEditing: isQuickSetEditing,
    addTagToCurrentFolder,
  } = useQuickSetEditSession();
  const sampleLoadingRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Current folder navigation state
  const [currentFolderId, setCurrentFolderIdInternal] = useState<NodeId | null>(null);
  // Recent picked tags for recommendations (most recent first)
  const [recentPickedTagIds, setRecentPickedTagIds] = useState<NodeId[]>([]);
  // Highlight tag ID (for search result click feedback)
  const [highlightTagId, setHighlightTagId] = useState<NodeId | null>(null);
  // Control rename modal for newly created folder
  const [renameFolderId, setRenameFolderId] = useState<NodeId | null>(null);
  // Control tag edit drawer (for editing existing tags)
  const [editTagId, setEditTagId] = useState<NodeId | null>(null);

  // Track if navigation is from popstate (to avoid pushing history again)
  const isPopstateRef = useRef(false);
  // Track previous folderId to avoid duplicate pushState
  const prevFolderIdRef = useRef<NodeId | null>(null);
  // Track previous taxonomy reference to detect full replacement (not just updates)
  const prevTaxonomyRef = useRef<Taxonomy | null>(null);

  /**
   * Read folder ID from URL query string.
   * Returns null for root (empty or missing folder param).
   */
  const getFolderIdFromUrl = useCallback((): NodeId | null => {
    const params = new URLSearchParams(window.location.search);
    const folder = params.get('folder');
    return folder || null;
  }, []);

  /**
   * Build URL with folder query param.
   */
  const buildUrl = useCallback((folderId: NodeId | null): string => {
    const url = new URL(window.location.href);
    if (folderId) {
      url.searchParams.set('folder', folderId);
    } else {
      url.searchParams.delete('folder');
    }
    return url.pathname + url.search;
  }, []);

  /**
   * Set currentFolderId with optional history push.
   * Handles all navigation logic including history sync.
   */
  const setCurrentFolderId = useCallback((folderId: NodeId | null, skipHistory = false) => {
    // Don't push if folderId hasn't changed
    if (folderId === prevFolderIdRef.current) {
      return;
    }

    prevFolderIdRef.current = folderId;
    setCurrentFolderIdInternal(folderId);

    // Skip history push if this is a popstate navigation or explicitly skipped
    if (!skipHistory && !isPopstateRef.current) {
      const url = buildUrl(folderId);
      history.pushState({ folderId }, '', url);
    }

    // Reset popstate flag
    isPopstateRef.current = false;
  }, [buildUrl]);

  /**
   * Initialize from URL on mount, and listen to popstate.
   */
  useLayoutEffect(() => {
    // Initial URL read - only set initial state, don't push history
    const initialFolderId = getFolderIdFromUrl();
    if (initialFolderId) {
      prevFolderIdRef.current = initialFolderId;
      setCurrentFolderIdInternal(initialFolderId);
      // Replace current history entry with state
      history.replaceState({ folderId: initialFolderId }, '', window.location.href);
    } else {
      // Root - ensure history state is set
      history.replaceState({ folderId: null }, '', window.location.href);
    }

    // Listen to popstate (back/forward)
    const handlePopstate = (event: PopStateEvent) => {
      isPopstateRef.current = true;
      const folderId = event.state?.folderId ?? getFolderIdFromUrl();
      prevFolderIdRef.current = folderId;
      setCurrentFolderIdInternal(folderId);
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [getFolderIdFromUrl]);

  /**
   * Validate folder ID after index is available.
   * If folder doesn't exist, reset to root.
   */
  useEffect(() => {
    if (!index || currentFolderId === null) return;

    const node = index.byId.get(currentFolderId);
    if (!node || node.kind !== 'folder') {
      loggerDevWarn(
        `[TagSelector] URL folder "${currentFolderId}" not found or not a folder. Resetting to root.`
      );
      // Reset to root with replaceState (don't add to history)
      prevFolderIdRef.current = null;
      setCurrentFolderIdInternal(null);
      const url = buildUrl(null);
      history.replaceState({ folderId: null }, '', url);
    }
  }, [index, currentFolderId, buildUrl]);

  // Extract extensions from taxonomy (centralized access)
  const { quickTrees, recommendationsConfig, historySize, folderNavigatorConfig } = useMemo(() => {
    if (!taxonomy) {
      return {
        quickTrees: [],
        recommendationsConfig: { version: 1 as const, map: {} },
        historySize: 3,
        folderNavigatorConfig: { version: 1 as const, mode: 'collapsed' as const, autoOpenFolderIds: [] },
      };
    }
    const ext = getExtensions(taxonomy);
    const fnConfig = ext.ui.folderNavigator ?? {
      version: 1 as const,
      mode: 'collapsed' as const,
      autoOpenFolderIds: [],
    };
    return {
      quickTrees: ext.quickTrees,
      recommendationsConfig: ext.recommendations,
      historySize: ext.recommendations.historySize ?? 3,
      folderNavigatorConfig: fnConfig,
    };
  }, [taxonomy]);

  const { handleImport, handleExport, fileInputRef } = useFileOperations({
    onImportSuccess: clear,
  });

  // Handle New Tree button
  const handleNewTree = useCallback(() => {
    const confirmMessage = uiLanguage === 'zh' 
      ? '确定要创建新树吗？这将清空当前分类和所有已选标签。'
      : 'Are you sure you want to create a new tree? This will clear the current taxonomy and all selected tags.';
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Create empty but valid Taxonomy
    const emptyTaxonomy: Taxonomy = {
      schemaVersion: SCHEMA_VERSION,
      nodes: [],
      meta: {
        name: uiLanguage === 'zh' ? '未命名' : 'Untitled',
      },
    };

    // Set the empty taxonomy (this will build index automatically)
    setTaxonomy(emptyTaxonomy);
    
    // Clear selection
    useSelectionStore.getState().clear();
    
    // Clear rules (get index after setTaxonomy, but it's built synchronously)
    const currentIndex = useTaxonomyStore.getState().index;
    useRulesStore.getState().setSavedRules([], currentIndex);
  }, [uiLanguage, setTaxonomy]);

  // Load sample taxonomy on mount
  useEffect(() => {
    if (!taxonomy && !sampleLoadingRef.current) {
      sampleLoadingRef.current = true;
      loadSampleTaxonomy()
        .then((sampleTaxonomy) => {
          setTaxonomy(sampleTaxonomy);
          // Sync rules from sample taxonomy extensions (same as import behavior)
          const extensions = getExtensions(sampleTaxonomy);
          const rules = extensions.rules.savedRules;
          // Get the newly built index (setTaxonomy already updated it)
          const currentIndex = useTaxonomyStore.getState().index;
          // Set rules (same as useFileOperations.handleImport)
          useRulesStore.getState().setSavedRules(rules, currentIndex);
        })
        .catch((err) => {
          loggerError('Failed to load sample taxonomy:', err);
          notifications.show({
            message: `样本数据加载失败: ${err instanceof Error ? err.message : 'Unknown error'}`,
            color: 'red',
            autoClose: 4000,
          });
        })
        .finally(() => {
          sampleLoadingRef.current = false;
        });
    }
  }, [taxonomy, setTaxonomy]);

  // Clean up selection and rules when index changes - remove invalid ids
  useEffect(() => {
    cleanupInvalidSelection(index);
    cleanupInvalidRules(index);
  }, [index, cleanupInvalidSelection, cleanupInvalidRules]);

  // Clear highlight after 2 seconds
  useEffect(() => {
    if (highlightTagId) {
      const timer = setTimeout(() => {
        setHighlightTagId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightTagId]);

  // Reset navigation and history when taxonomy is fully replaced (import/clear), not on updates
  useEffect(() => {
    const prevTaxonomy = prevTaxonomyRef.current;
    
    // Only reset if:
    // 1. Taxonomy changed from null to non-null (initial load or import)
    // 2. Taxonomy changed from non-null to null (clear)
    // 3. Taxonomy meta.name changed (new tree created or imported different taxonomy)
    const shouldReset = 
      (prevTaxonomy === null && taxonomy !== null) || // null -> non-null
      (prevTaxonomy !== null && taxonomy === null) || // non-null -> null
      (prevTaxonomy !== null && taxonomy !== null && 
       prevTaxonomy.meta.name !== taxonomy.meta.name); // meta.name changed (new tree)
    
    if (shouldReset) {
      prevFolderIdRef.current = null;
      setCurrentFolderIdInternal(null);
      setRecentPickedTagIds([]);
      // Reset URL to root
      const url = buildUrl(null);
      history.replaceState({ folderId: null }, '', url);
    }
    
    // Update ref for next comparison
    prevTaxonomyRef.current = taxonomy;
  }, [taxonomy, buildUrl]);

  // ========================================================================
  // Runtime Rule Enforcement
  // ========================================================================

  /**
   * Compute excluded tags based on current selection and saved rules.
   * Only compute when rules panel is closed.
   */
  const excludedTagIds = useMemo(() => {
    if (isPanelOpen) {
      // When editing rules, don't exclude anything
      return new Set<NodeId>();
    }
    return computeExcludedTags(selectedIds, savedRules);
  }, [isPanelOpen, selectedIds, savedRules]);

  /**
   * Auto-add required tags when selection changes.
   * Only runs when rules panel is closed.
   * Uses batch update (addMany) to avoid multiple effect triggers.
   */
  useEffect(() => {
    if (isPanelOpen) {
      // When editing rules, don't auto-add
      return;
    }

    const requiredTags = computeRequiredTags(selectedIds, savedRules);
    if (requiredTags.size > 0) {
      // Batch add all required tags in a single state update
      addMany(Array.from(requiredTags));
    }
  }, [isPanelOpen, selectedIds, savedRules, addMany]);

  // ========================================================================
  // Event Handlers
  // ========================================================================

  /**
   * Handle tag toggle with:
   * - Editing mode handling (highest priority - open edit drawer)
   * - QuickSet editing mode handling
   * - recentPickedTagIds history tracking
   * - Rules panel click handling
   * - Normal selection toggle
   * 
   * Mode priorities:
   * 1. Editing mode (isEditing): open tag edit drawer
   * 2. QuickSet editing mode: add tag to current QuickSet folder
   * 3. Rules panel open: let rules handle it
   * 4. Normal mode: toggle selection
   */
  const handleToggleTag = useCallback((tagId: NodeId) => {
    // Editing mode: open tag edit drawer (don't toggle selection)
    if (isEditing) {
      setEditTagId(tagId);
      return;
    }

    // QuickSet editing mode: add tag to current folder
    if (isQuickSetEditing) {
      const result = addTagToCurrentFolder(tagId);
      
      if (result === 'duplicate') {
        // Show notification for duplicate
        notifications.show({
          title: '标签已存在',
          message: '该标签已在当前文件夹中',
          color: 'yellow',
          autoClose: 2000,
        });
      } else if (result === 'added') {
        // Optional: show success notification
        notifications.show({
          title: '已添加',
          message: '标签已添加到当前文件夹',
          color: 'green',
          autoClose: 1500,
        });
      }
      // Do NOT touch selectedIds in editing mode
      return;
    }

    // When rules panel is open, first check if rules panel wants to handle this click
    if (isPanelOpen) {
      handleTagClick(tagId);
      // Whether handled or not, don't proceed to selection toggle
      // when rules panel is open
      return;
    }

    // Normal selection toggle (rules panel is closed)
    const wasSelected = selectedIds.has(tagId);
    toggle(tagId);
    
    // Update recentPickedTagIds only when selecting (not deselecting)
    if (!wasSelected) {
      setRecentPickedTagIds((prev) => {
        // Remove if already exists (dedupe)
        const filtered = prev.filter((id) => id !== tagId);
        // Add to front (most recent first)
        const updated = [tagId, ...filtered];
        // Trim to historySize
        return updated.slice(0, historySize);
      });
    }
  }, [isEditing, isQuickSetEditing, addTagToCurrentFolder, isPanelOpen, selectedIds, toggle, handleTagClick, historySize]);

  /**
   * Handle folder navigation (from left tree or right panel folder clicks).
   * 
   * Navigation Guard (总闸):
   * - folderId === null: allowed (navigate to Root)
   * - folderId exists in index AND kind === 'folder': allowed
   * - Otherwise: rejected with console.warn
   * 
   * This function pushes to browser history for Back/Forward support.
   */
  const handleNavigateToFolder = useCallback((folderId: NodeId | null) => {
    // null means Root - always allowed
    if (folderId === null) {
      setCurrentFolderId(null);
      return;
    }

    // Guard: must exist and be a folder
    if (!index) {
      loggerDevWarn(
        `[TagSelector] Navigation rejected: index not available. ` +
        `Attempted to navigate to: ${folderId}`
      );
      return;
    }

    const node = index.byId.get(folderId);
    if (!node) {
      loggerDevWarn(
        `[TagSelector] Navigation rejected: node not found. ` +
        `Attempted to navigate to: ${folderId}`
      );
      return;
    }

    if (node.kind !== 'folder') {
      loggerDevWarn(
        `[TagSelector] Navigation rejected: "${node.label}" (id: ${folderId}) is a ${node.kind}, not a folder. ` +
        `currentFolderId must only be null (Root) or a folder ID.`
      );
      return;
    }

    // Valid folder navigation (pushes to history)
    setCurrentFolderId(folderId);
  }, [index, setCurrentFolderId]);

  // Loading state
  if (!index || !taxonomy) {
    return (
      <AppShell>
        <AppShell.Main style={{ padding: '20px' }}>
          <p>Loading taxonomy...</p>
        </AppShell.Main>
      </AppShell>
    );
  }

  // Handle create folder
  const handleCreateFolder = useCallback(() => {
    if (!index) return;
    
    const defaultLabel = uiLanguage === 'zh' ? '新文件夹' : 'New Folder';
    const newFolderId = createNode('folder', currentFolderId, defaultLabel);
    
    if (!newFolderId) {
      loggerError('[TagSelector] Failed to create folder: createNode returned null');
      return;
    }
    
    // Get fresh index after createNode (it rebuilds the index)
    const freshIndex = useTaxonomyStore.getState().index;
    
    if (!freshIndex || !freshIndex.byId.has(newFolderId)) {
      loggerError('[TagSelector] New folder not found in index after creation');
      return;
    }
    
    // Directly set currentFolderId (bypass handleNavigateToFolder which uses stale index)
    // The new folder was just created by createNode, so we know it's valid
    setCurrentFolderId(newFolderId);
    // Set renameFolderId to trigger the rename modal
    setRenameFolderId(newFolderId);
  }, [index, uiLanguage, currentFolderId, createNode, setCurrentFolderId]);

  // Handle create tag
  const handleCreateTag = useCallback(() => {
    if (!index) return;
    
    const newTagId = createNode('tag', currentFolderId, 'new_tag');
    
    if (newTagId) {
      // Open tag edit drawer for the new tag
      setEditTagId(newTagId);
    }
  }, [index, currentFolderId, createNode]);

  // Left bottom controls section
  const leftBottomControlsSection = (
    <CreateNodeButtons
      currentFolderId={currentFolderId}
      onCreateFolder={handleCreateFolder}
      onCreateTag={handleCreateTag}
    />
  );

  return (
    <>
    <AppShellLayout
      isDesktop={!!isDesktop}
      leftBottomSection={leftBottomControlsSection}
      errorBarSection={
        validationErrors.length > 0 ? (
          <ValidationErrorBar
            errors={validationErrors}
            onDismiss={clearValidationErrors}
          />
        ) : null
      }
      searchSection={
        <Stack gap="xs">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder={uiLanguage === 'zh' ? '搜索文件夹或标签...' : 'Search folders or tags...'} 
          />
          <SearchResultsPanel
            index={index}
            query={searchQuery}
            onPickFolder={(id) => {
              handleNavigateToFolder(id);
              setSearchQuery('');
            }}
            onPickTag={(tagId) => {
              // 找到 tag 的最近祖先 folder
              let cur = index.byId.get(tagId);
              let folderId: NodeId | null = null;
              while (cur) {
                if (cur.kind === 'folder') {
                  folderId = cur.id;
                  break;
                }
                const pid = cur.parentId;
                if (!pid) {
                  folderId = null;
                  break;
                }
                cur = index.byId.get(pid);
              }
              handleNavigateToFolder(folderId);
              setSearchQuery('');
              setHighlightTagId(tagId);
            }}
          />
        </Stack>
      }
      treeSection={
        // Left tree: FolderNavigator (folder-only, click = navigate)
        <FolderNavigator
          index={index}
          currentFolderId={currentFolderId}
          onNavigateToFolder={handleNavigateToFolder}
          searchQuery={searchQuery}
          folderNavigatorConfig={folderNavigatorConfig}
        />
      }
      quickSetsSection={
        <QuickSetsPanel
          quickTrees={quickTrees}
          taxonomy={taxonomy}
          index={index}
          currentFolderId={currentFolderId}
          selectedIds={selectedIds}
          onNavigateToFolder={handleNavigateToFolder}
          onToggleTag={handleToggleTag}
        />
      }
      importExportSection={
        <Stack gap="sm">
          <Group gap="sm" justify="space-between">
            <Group gap="sm">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
              <Button size="sm" onClick={handleNewTree}>
                {uiLanguage === 'zh' ? '新建' : 'New Tree'}
              </Button>
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                {uiLanguage === 'zh' ? '导入' : 'Import'}
              </Button>
              <Button size="sm" onClick={handleExport}>
                {uiLanguage === 'zh' ? '导出' : 'Export'}
              </Button>
            </Group>
            <Group gap="sm">
              <RulesToggleButton />
              <LanguageToggle />
            </Group>
          </Group>
        </Stack>
      }
      currentFolderHeader={
        <CurrentFolderHeader
          index={index}
          currentFolderId={currentFolderId}
          onNavigateToFolder={handleNavigateToFolder}
          renameFolderId={renameFolderId}
          onRenameModalClose={() => setRenameFolderId(null)}
        />
      }
      mainWorkArea={
        <div
          style={{
            display: 'flex',
            height: '100%',
            gap: '0',
            overflow: 'hidden',
          }}
        >
          {/* Picker area (shrinks when rules panel is open) */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            {/* Main: CurrentLevelView (folders + tags in current folder) */}
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <CurrentLevelView
                index={index}
                currentFolderId={currentFolderId}
                selectedIds={selectedIds}
                excludedTagIds={excludedTagIds}
                highlightTagId={highlightTagId}
                isEditing={isEditing}
                onEnterFolder={handleNavigateToFolder}
                onToggleTag={handleToggleTag}
              />
            </div>
          </div>
          {/* Rules Panel (side panel, squeezes picker) */}
          {isPanelOpen && <RulesPanel index={index} />}
        </div>
      }
      bottomAboveSelectionSection={
        <RecommendationsPanel
          index={index}
          currentFolderId={currentFolderId}
          recentPickedTagIds={recentPickedTagIds}
          recommendationsConfig={recommendationsConfig}
          selectedIds={selectedIds}
          onToggleTag={handleToggleTag}
        />
      }
      selectionSection={
        <SelectionChips
          index={index}
          selectedIds={selectedIds}
          onDeselect={toggle}
          onClear={clear}
        />
      }
      exportPreviewSection={
        <ExportPreview
          index={index}
          selectedIds={selectedIds}
        />
      }
      bottomModeSection={
        isQuickSetEditing ? (
          <QuickSetBuilder
            index={index}
            onNotify={(message, type) => {
              notifications.show({
                message,
                color: type === 'success' ? 'green' : type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'blue',
                autoClose: 2000,
              });
            }}
          />
        ) : undefined
      }
    />
    {/* Tag Edit Drawer */}
    <TagEditDrawer
      opened={editTagId !== null}
      onClose={() => setEditTagId(null)}
      tagId={editTagId}
      index={index}
    />
    </>
  );
}
