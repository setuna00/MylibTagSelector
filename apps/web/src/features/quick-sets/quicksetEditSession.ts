/**
 * QuickSet Edit Session Store
 *
 * Manages the state for QuickSet editing mode.
 * Uses zustand for state management.
 *
 * Key features:
 * - Tracks whether we're in editing mode
 * - Manages draft state (deep copy from taxonomy)
 * - Tracks current cursor position within QuickSet folder structure
 * - Provides all CRUD operations for QuickSet editing
 * - Migration from old QuickTree format to new QS format
 */

import { create } from 'zustand';
import type { NodeId, Taxonomy, TaxonomyIndex } from '@tagselector/tag-core';
import type { QuickTree, QuickTreeNode } from '../../types/project-pack';
import type { QuickSet, QSNode, QSFolder, QSTag } from './types';
import { generateQSId, createEmptyQuickSet, createEmptyFolder, createTagRef } from './types';
import { getExtensions, injectExtensions } from '../../utils/extensions';
import { useTaxonomyStore } from '../../store';

// ============================================================================
// Migration: Old QuickTree format -> New QuickSet format
// ============================================================================

/**
 * Migration result from old format to new format.
 */
export interface MigrationResult {
  quickSets: QuickSet[];
  /** Warnings about skipped nodes (e.g., folder refs, invalid refs) */
  warnings: string[];
}

/**
 * Migrate a QuickTreeNode to QSNode.
 * - 'group' nodes become QSFolder
 * - 'ref' nodes with tag kind become QSTag
 * - 'ref' nodes with folder kind are skipped (not allowed in new format)
 */
function migrateNode(
  node: QuickTreeNode,
  index: TaxonomyIndex | null,
  warnings: string[]
): QSNode | null {
  if (node.type === 'group') {
    const children: QSNode[] = [];
    for (const child of node.children) {
      const migrated = migrateNode(child, index, warnings);
      if (migrated) {
        children.push(migrated);
      }
    }
    return {
      id: node.id || generateQSId(),
      type: 'folder',
      name: node.label,
      children,
    };
  }

  // type === 'ref'
  if (!index) {
    warnings.push(`无法验证引用 "${node.refId}"（索引不可用）`);
    // Still include it, but warn
    return createTagRef(node.refId);
  }

  const refNode = index.byId.get(node.refId);
  if (!refNode) {
    warnings.push(`引用 "${node.refId}" 在主树中不存在，已跳过`);
    return null;
  }

  if (refNode.kind === 'folder') {
    warnings.push(`文件夹引用 "${refNode.label}" (${node.refId}) 不再支持，已跳过`);
    return null;
  }

  // Valid tag reference
  return createTagRef(node.refId);
}

/**
 * Migrate old QuickTree[] format to new QuickSet[] format.
 */
export function migrateQuickTrees(
  quickTrees: QuickTree[],
  index: TaxonomyIndex | null
): MigrationResult {
  const warnings: string[] = [];
  const quickSets: QuickSet[] = [];

  for (const tree of quickTrees) {
    const rootChildren: QSNode[] = [];
    for (const node of tree.roots) {
      const migrated = migrateNode(node, index, warnings);
      if (migrated) {
        rootChildren.push(migrated);
      }
    }

    quickSets.push({
      id: tree.id,
      name: tree.name,
      root: {
        id: 'root',
        type: 'folder',
        name: 'root',
        children: rootChildren,
      },
    });
  }

  return { quickSets, warnings };
}

/**
 * Convert QuickSet[] back to QuickTree[] format for storage.
 */
function convertToQuickTrees(quickSets: QuickSet[]): QuickTree[] {
  function convertNode(node: QSNode): QuickTreeNode {
    if (node.type === 'folder') {
      return {
        type: 'group',
        id: node.id,
        label: node.name,
        children: node.children.map(convertNode),
      };
    }
    // type === 'tag'
    return {
      type: 'ref',
      refId: node.tagId,
    };
  }

  return quickSets.map((qs) => ({
    id: qs.id,
    name: qs.name,
    roots: qs.root.children.map(convertNode),
  }));
}

// ============================================================================
// Store Types
// ============================================================================

interface QuickSetEditSessionState {
  /** Whether we're currently in editing mode */
  isEditing: boolean;
  /** ID of the QuickSet being edited (null if not editing) */
  editingQuickSetId: string | null;
  /** Current cursor position within the QuickSet folder structure */
  cursorFolderId: string;
  /** Draft state - deep copy of all QuickSets */
  draftQuickSets: QuickSet[];
  /** Whether draft has unsaved changes */
  dirty: boolean;
  /** Migration warnings from last init */
  migrationWarnings: string[];
}

interface QuickSetEditSessionActions {
  // ========================================================================
  // Session lifecycle
  // ========================================================================
  
  /**
   * Initialize draft from taxonomy and enter editing mode.
   * @param quickSetId - ID of QuickSet to edit (or null to just init draft)
   */
  initDraftFromTaxonomy: (quickSetId?: string | null) => void;
  
  /**
   * Enter editing mode for a specific QuickSet.
   */
  enterEditMode: (quickSetId: string) => void;
  
  /**
   * Cancel editing - discard all changes and exit edit mode.
   */
  cancelEditing: () => void;
  
  /**
   * Save changes to taxonomy and exit edit mode.
   */
  saveAndExit: () => void;

  // ========================================================================
  // Navigation
  // ========================================================================
  
  /**
   * Navigate to a folder within the current QuickSet.
   */
  navigateToFolder: (folderId: string) => void;
  
  /**
   * Navigate to root folder.
   */
  navigateToRoot: () => void;

  // ========================================================================
  // QuickSet CRUD
  // ========================================================================
  
  /**
   * Create a new QuickSet and enter edit mode.
   */
  createQuickSet: (name: string) => void;
  
  /**
   * Delete a QuickSet from draft.
   */
  deleteQuickSet: (quickSetId: string) => void;
  
  /**
   * Rename a QuickSet.
   */
  renameQuickSet: (quickSetId: string, newName: string) => void;

  // ========================================================================
  // Folder operations
  // ========================================================================
  
  /**
   * Create a new folder in the current cursor folder.
   */
  createFolderInCurrentFolder: (name: string) => void;
  
  /**
   * Rename a folder.
   */
  renameFolder: (folderId: string, newName: string) => void;
  
  /**
   * Delete a folder. Returns false if folder is non-empty (requires confirmation).
   */
  deleteFolder: (folderId: string, force?: boolean) => boolean;
  
  /**
   * Check if a folder is empty.
   */
  isFolderEmpty: (folderId: string) => boolean;

  // ========================================================================
  // Tag operations
  // ========================================================================
  
  /**
   * Add a tag to the current cursor folder.
   * Returns 'added' | 'duplicate' | 'error'.
   */
  addTagToCurrentFolder: (tagId: NodeId) => 'added' | 'duplicate' | 'error';
  
  /**
   * Remove a tag from the current cursor folder.
   */
  removeTagFromCurrentFolder: (tagId: NodeId) => void;

  // ========================================================================
  // Helpers
  // ========================================================================
  
  /**
   * Get the current QuickSet being edited.
   */
  getEditingQuickSet: () => QuickSet | null;
  
  /**
   * Get the current cursor folder.
   */
  getCurrentFolder: () => QSFolder | null;
  
  /**
   * Get breadcrumb path from root to current folder.
   */
  getBreadcrumbPath: () => Array<{ id: string; name: string }>;
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Find a folder by ID within a QuickSet (recursive).
 */
function findFolderById(root: QSFolder, folderId: string): QSFolder | null {
  if (root.id === folderId) {
    return root;
  }
  for (const child of root.children) {
    if (child.type === 'folder') {
      const found = findFolderById(child, folderId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Build breadcrumb path from root to target folder.
 */
function buildBreadcrumbPath(
  root: QSFolder,
  targetId: string,
  currentPath: Array<{ id: string; name: string }> = []
): Array<{ id: string; name: string }> | null {
  const path = [...currentPath, { id: root.id, name: root.name }];
  
  if (root.id === targetId) {
    return path;
  }
  
  for (const child of root.children) {
    if (child.type === 'folder') {
      const found = buildBreadcrumbPath(child, targetId, path);
      if (found) return found;
    }
  }
  
  return null;
}

/**
 * Deep clone an object.
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================================
// Store
// ============================================================================

export const useQuickSetEditSession = create<QuickSetEditSessionState & QuickSetEditSessionActions>()(
  (set, get) => ({
    // Initial state
    isEditing: false,
    editingQuickSetId: null,
    cursorFolderId: 'root',
    draftQuickSets: [],
    dirty: false,
    migrationWarnings: [],

    // ========================================================================
    // Session lifecycle
    // ========================================================================

    initDraftFromTaxonomy: (quickSetId?: string | null) => {
      const { taxonomy, index } = useTaxonomyStore.getState();
      if (!taxonomy) {
        console.warn('[QuickSetEditSession] Cannot init: no taxonomy loaded');
        return;
      }

      const ext = getExtensions(taxonomy);
      const { quickSets, warnings } = migrateQuickTrees(ext.quickTrees, index);

      set({
        draftQuickSets: quickSets,
        migrationWarnings: warnings,
        dirty: false,
        cursorFolderId: 'root',
        isEditing: quickSetId ? true : false,
        editingQuickSetId: quickSetId ?? null,
      });

      if (warnings.length > 0) {
        console.warn('[QuickSetEditSession] Migration warnings:', warnings);
      }
    },

    enterEditMode: (quickSetId: string) => {
      const { draftQuickSets, initDraftFromTaxonomy } = get();
      
      // If draft is empty, init from taxonomy first
      if (draftQuickSets.length === 0) {
        initDraftFromTaxonomy(quickSetId);
        return;
      }

      // Verify QuickSet exists
      const qs = draftQuickSets.find((q) => q.id === quickSetId);
      if (!qs) {
        console.warn(`[QuickSetEditSession] QuickSet "${quickSetId}" not found`);
        return;
      }

      set({
        isEditing: true,
        editingQuickSetId: quickSetId,
        cursorFolderId: 'root',
      });
    },

    cancelEditing: () => {
      // Reset to taxonomy state (discard all draft changes)
      const { taxonomy, index } = useTaxonomyStore.getState();
      if (taxonomy) {
        const ext = getExtensions(taxonomy);
        const { quickSets } = migrateQuickTrees(ext.quickTrees, index);
        set({
          draftQuickSets: quickSets,
        });
      }

      set({
        isEditing: false,
        editingQuickSetId: null,
        cursorFolderId: 'root',
        dirty: false,
        migrationWarnings: [],
      });
    },

    saveAndExit: () => {
      const { draftQuickSets } = get();
      const { taxonomy, setTaxonomy } = useTaxonomyStore.getState();
      
      if (!taxonomy) {
        console.warn('[QuickSetEditSession] Cannot save: no taxonomy loaded');
        return;
      }

      // Convert back to QuickTree format for storage
      const quickTrees = convertToQuickTrees(draftQuickSets);
      
      // Inject into taxonomy
      const newTaxonomy = injectExtensions(taxonomy, { quickTrees });
      setTaxonomy(newTaxonomy);

      set({
        isEditing: false,
        editingQuickSetId: null,
        cursorFolderId: 'root',
        dirty: false,
      });
    },

    // ========================================================================
    // Navigation
    // ========================================================================

    navigateToFolder: (folderId: string) => {
      set({ cursorFolderId: folderId });
    },

    navigateToRoot: () => {
      set({ cursorFolderId: 'root' });
    },

    // ========================================================================
    // QuickSet CRUD
    // ========================================================================

    createQuickSet: (name: string) => {
      const newQS = createEmptyQuickSet(name);
      
      set((state) => ({
        draftQuickSets: [...state.draftQuickSets, newQS],
        isEditing: true,
        editingQuickSetId: newQS.id,
        cursorFolderId: 'root',
        dirty: true,
      }));
    },

    deleteQuickSet: (quickSetId: string) => {
      set((state) => {
        const newList = state.draftQuickSets.filter((q) => q.id !== quickSetId);
        const newState: Partial<QuickSetEditSessionState> = {
          draftQuickSets: newList,
          dirty: true,
        };
        
        // If we were editing the deleted QuickSet, exit edit mode
        if (state.editingQuickSetId === quickSetId) {
          newState.isEditing = false;
          newState.editingQuickSetId = null;
          newState.cursorFolderId = 'root';
        }
        
        return newState as QuickSetEditSessionState;
      });
    },

    renameQuickSet: (quickSetId: string, newName: string) => {
      set((state) => ({
        draftQuickSets: state.draftQuickSets.map((qs) =>
          qs.id === quickSetId ? { ...qs, name: newName } : qs
        ),
        dirty: true,
      }));
    },

    // ========================================================================
    // Folder operations
    // ========================================================================

    createFolderInCurrentFolder: (name: string) => {
      const { editingQuickSetId, cursorFolderId, draftQuickSets } = get();
      if (!editingQuickSetId) return;

      const newFolder = createEmptyFolder(name);

      set({
        draftQuickSets: draftQuickSets.map((qs) => {
          if (qs.id !== editingQuickSetId) return qs;

          const newQS = deepClone(qs);
          const targetFolder = findFolderById(newQS.root, cursorFolderId);
          if (targetFolder) {
            targetFolder.children.push(newFolder);
          }
          return newQS;
        }),
        dirty: true,
      });
    },

    renameFolder: (folderId: string, newName: string) => {
      const { editingQuickSetId, draftQuickSets } = get();
      if (!editingQuickSetId) return;

      set({
        draftQuickSets: draftQuickSets.map((qs) => {
          if (qs.id !== editingQuickSetId) return qs;

          const newQS = deepClone(qs);
          const folder = findFolderById(newQS.root, folderId);
          if (folder) {
            folder.name = newName;
          }
          return newQS;
        }),
        dirty: true,
      });
    },

    isFolderEmpty: (folderId: string) => {
      const { getEditingQuickSet } = get();
      const qs = getEditingQuickSet();
      if (!qs) return true;

      const folder = findFolderById(qs.root, folderId);
      return !folder || folder.children.length === 0;
    },

    deleteFolder: (folderId: string, force = false) => {
      const { editingQuickSetId, draftQuickSets, cursorFolderId, isFolderEmpty } = get();
      if (!editingQuickSetId) return false;

      // Check if empty (unless force)
      if (!force && !isFolderEmpty(folderId)) {
        return false; // Caller should show confirmation
      }

      // Helper to remove folder from children
      const removeFolder = (folder: QSFolder): boolean => {
        const idx = folder.children.findIndex(
          (c) => c.type === 'folder' && c.id === folderId
        );
        if (idx !== -1) {
          folder.children.splice(idx, 1);
          return true;
        }
        for (const child of folder.children) {
          if (child.type === 'folder' && removeFolder(child)) {
            return true;
          }
        }
        return false;
      };

      set((state) => {
        const newQSList = state.draftQuickSets.map((qs) => {
          if (qs.id !== editingQuickSetId) return qs;

          const newQS = deepClone(qs);
          removeFolder(newQS.root);
          return newQS;
        });

        // If cursor was in deleted folder, navigate to root
        const shouldResetCursor = cursorFolderId === folderId;

        return {
          draftQuickSets: newQSList,
          dirty: true,
          cursorFolderId: shouldResetCursor ? 'root' : cursorFolderId,
        };
      });

      return true;
    },

    // ========================================================================
    // Tag operations
    // ========================================================================

    addTagToCurrentFolder: (tagId: NodeId) => {
      const { editingQuickSetId, cursorFolderId, draftQuickSets } = get();
      if (!editingQuickSetId) return 'error';

      // Find current folder and check for duplicate
      const qs = draftQuickSets.find((q) => q.id === editingQuickSetId);
      if (!qs) return 'error';

      const folder = findFolderById(qs.root, cursorFolderId);
      if (!folder) return 'error';

      // Check for duplicate
      const isDuplicate = folder.children.some(
        (c) => c.type === 'tag' && c.tagId === tagId
      );
      if (isDuplicate) return 'duplicate';

      // Add tag
      const newTag = createTagRef(tagId);

      set({
        draftQuickSets: draftQuickSets.map((q) => {
          if (q.id !== editingQuickSetId) return q;

          const newQS = deepClone(q);
          const targetFolder = findFolderById(newQS.root, cursorFolderId);
          if (targetFolder) {
            targetFolder.children.push(newTag);
          }
          return newQS;
        }),
        dirty: true,
      });

      return 'added';
    },

    removeTagFromCurrentFolder: (tagId: NodeId) => {
      const { editingQuickSetId, cursorFolderId, draftQuickSets } = get();
      if (!editingQuickSetId) return;

      set({
        draftQuickSets: draftQuickSets.map((qs) => {
          if (qs.id !== editingQuickSetId) return qs;

          const newQS = deepClone(qs);
          const folder = findFolderById(newQS.root, cursorFolderId);
          if (folder) {
            folder.children = folder.children.filter(
              (c) => !(c.type === 'tag' && c.tagId === tagId)
            );
          }
          return newQS;
        }),
        dirty: true,
      });
    },

    // ========================================================================
    // Helpers
    // ========================================================================

    getEditingQuickSet: () => {
      const { editingQuickSetId, draftQuickSets } = get();
      if (!editingQuickSetId) return null;
      return draftQuickSets.find((q) => q.id === editingQuickSetId) ?? null;
    },

    getCurrentFolder: () => {
      const { getEditingQuickSet, cursorFolderId } = get();
      const qs = getEditingQuickSet();
      if (!qs) return null;
      return findFolderById(qs.root, cursorFolderId);
    },

    getBreadcrumbPath: () => {
      const { getEditingQuickSet, cursorFolderId } = get();
      const qs = getEditingQuickSet();
      if (!qs) return [];

      const path = buildBreadcrumbPath(qs.root, cursorFolderId);
      return path ?? [{ id: 'root', name: 'root' }];
    },
  })
);

