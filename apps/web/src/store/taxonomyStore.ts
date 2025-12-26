/**
 * Taxonomy Store
 *
 * Manages the taxonomy data and index.
 * 
 * Rehydration Validation:
 * - On rehydrate, validates taxonomy before building index
 * - Invalid taxonomy logs warning but still builds index (UI can still run with guards)
 * - Validation errors are stored for UI display
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Taxonomy, TaxonomyIndex, NodeId, TagNode } from '@tagselector/tag-core';
import {
  buildTaxonomyIndex,
  importTaxonomy,
  exportTaxonomy,
  validateTaxonomy,
  normalizeOrder,
} from '@tagselector/tag-core';
import type { ValidationError } from '@tagselector/tag-core';
import { useRulesStore } from './rulesStore';
import type { TaxonomyExtensions } from '../types/project-pack';

interface TaxonomyState {
  taxonomy: Taxonomy | null;
  index: TaxonomyIndex | null;
  error: string | null;
  /** Validation errors from import or rehydrate (for UI display) */
  validationErrors: ValidationError[];
  isLoading: boolean;
}

interface TaxonomyActions {
  loadTaxonomy: (jsonString: string) => { ok: true; taxonomy: Taxonomy } | { ok: false; error: string };
  setTaxonomy: (taxonomy: Taxonomy) => void;
  clearTaxonomy: () => void;
  exportToJson: () => string | null;
  /** Export project pack (taxonomy + rules + quickTrees + recommendations) */
  exportProjectPack: () => string | null;
  /** Clear validation errors (user dismissed the error bar) */
  clearValidationErrors: () => void;
  /** Update a node's label (or taxonomy.meta.name for Root) */
  updateNodeLabel: (nodeId: NodeId | null, newLabel: string) => void;
  /** Update a tag's data fields (label, displayName, color, aliases) */
  updateTagData: (
    tagId: NodeId,
    updates: {
      label?: string;
      displayName?: string;
      color?: string;
      aliases?: string[];
    }
  ) => void;
  /** Swap node order with previous or next sibling, then normalize all sibling orders */
  swapNodeOrder: (nodeId: NodeId, direction: 'up' | 'down') => void;
  /** Delete a node (tag or empty folder). Returns success status and removed tag IDs for cleanup. */
  deleteNode: (nodeId: NodeId) => 
    | { success: true; removedTagIds: NodeId[] } 
    | { success: false; reason: 'not_found' | 'folder_not_empty' };
  /** Create a new node (folder or tag) */
  createNode: (kind: 'folder' | 'tag', parentId: NodeId | null, defaultLabel: string) => NodeId | null;
}

export const useTaxonomyStore = create<TaxonomyState & TaxonomyActions>()(
  persist(
    (set, get) => ({
      taxonomy: null,
      index: null,
      error: null,
      validationErrors: [],
      isLoading: false,

      loadTaxonomy: (jsonString: string) => {
        set({ isLoading: true, error: null, validationErrors: [] });

        const result = importTaxonomy(jsonString);

        if (result.success && result.taxonomy) {
          const index = buildTaxonomyIndex(result.taxonomy);
          set({
            taxonomy: result.taxonomy,
            index,
            error: null,
            validationErrors: [],
            isLoading: false,
          });
          return { ok: true as const, taxonomy: result.taxonomy };
        } else {
          const errors = result.errors || [];
          const errorMessages = errors
            .map((e) => `${e.path}: ${e.message}`)
            .join('; ');
          const error = errorMessages || 'Unknown error';
          
          // Log to console
          console.warn('[TagSelector] Import validation errors:', errors);
          
          set({
            error,
            validationErrors: errors,
            isLoading: false,
          });
          return { ok: false as const, error };
        }
      },

      setTaxonomy: (taxonomy: Taxonomy) => {
        const index = buildTaxonomyIndex(taxonomy);
        set({
          taxonomy,
          index,
          error: null,
          validationErrors: [],
          isLoading: false,
        });
      },

      clearTaxonomy: () => {
        set({
          taxonomy: null,
          index: null,
          error: null,
          validationErrors: [],
          isLoading: false,
        });
      },

      exportToJson: () => {
        const { taxonomy } = get();
        if (!taxonomy) return null;
        return exportTaxonomy(taxonomy, { pretty: true });
      },

      exportProjectPack: () => {
        const { taxonomy } = get();
        if (!taxonomy) return null;

        // Get savedRules from rulesStore
        const { savedRules } = useRulesStore.getState();

        // Get existing extensions (safely handle undefined meta)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingExt = (taxonomy.meta as any)?.extensions ?? {};

        // Construct new extensions (preserve existing ui config)
        const newExtensions: TaxonomyExtensions = {
          ...existingExt,
          rules: { version: 1, savedRules },
          quickTrees: existingExt.quickTrees ?? [],
          recommendations: existingExt.recommendations ?? { version: 1, map: {} },
          ui: existingExt.ui, // Preserve ui config if exists
        };

        // Deep copy taxonomy with merged extensions (immutable)
        const projectPack: Taxonomy = {
          ...taxonomy,
          meta: {
            ...taxonomy.meta,
            extensions: newExtensions,
          },
        };

        return exportTaxonomy(projectPack, { pretty: true });
      },

      clearValidationErrors: () => {
        set({ validationErrors: [], error: null });
      },

      updateNodeLabel: (nodeId: NodeId | null, newLabel: string) => {
        const { taxonomy } = get();
        if (!taxonomy) return;

        // Handle Root (nodeId === null): update taxonomy.meta.name
        if (nodeId === null) {
          const updatedTaxonomy: Taxonomy = {
            ...taxonomy,
            meta: {
              ...taxonomy.meta,
              name: newLabel,
            },
          };
          const index = buildTaxonomyIndex(updatedTaxonomy);
          set({ taxonomy: updatedTaxonomy, index });
          return;
        }

        // Handle regular folder: update node.label
        const nodeIndex = taxonomy.nodes.findIndex((n) => n.id === nodeId);
        if (nodeIndex === -1) {
          console.warn(`[TagSelector] Node ${nodeId} not found for label update`);
          return;
        }

        const updatedNodes = [...taxonomy.nodes];
        updatedNodes[nodeIndex] = {
          ...updatedNodes[nodeIndex],
          label: newLabel,
        };

        const updatedTaxonomy: Taxonomy = {
          ...taxonomy,
          nodes: updatedNodes,
        };

        const index = buildTaxonomyIndex(updatedTaxonomy);
        set({ taxonomy: updatedTaxonomy, index });
      },

      updateTagData: (
        tagId: NodeId,
        updates: {
          label?: string;
          displayName?: string;
          color?: string;
          aliases?: string[];
        }
      ) => {
        const { taxonomy } = get();
        if (!taxonomy) return;

        const nodeIndex = taxonomy.nodes.findIndex((n) => n.id === tagId);
        if (nodeIndex === -1) {
          console.warn(`[TagSelector] Tag ${tagId} not found for data update`);
          return;
        }

        const node = taxonomy.nodes[nodeIndex];
        if (node.kind !== 'tag') {
          console.warn(`[TagSelector] Node ${tagId} is not a tag`);
          return;
        }

        // Type assertion for node with data field
        const nodeWithData = node as TagNode & {
          data?: { displayName?: string; aliases?: string[]; color?: string };
        };

        // Build updated node
        const updatedNode: TagNode & {
          data?: { displayName?: string; aliases?: string[]; color?: string };
        } = {
          ...node,
          ...(updates.label !== undefined ? { label: updates.label } : {}),
        };

        // Update data field
        const currentData = nodeWithData.data || {};
        const updatedData: { displayName?: string; aliases?: string[]; color?: string } = { ...currentData };
        
        // Handle displayName: if undefined, don't update; if empty string, delete it; otherwise update
        if (updates.displayName !== undefined) {
          if (updates.displayName === '') {
            delete updatedData.displayName;
          } else {
            updatedData.displayName = updates.displayName;
          }
        }
        
        // Handle color: if undefined, don't update; if empty string, delete it; otherwise update
        if (updates.color !== undefined) {
          if (updates.color === '') {
            delete updatedData.color;
          } else {
            updatedData.color = updates.color;
          }
        }
        
        // Handle aliases: if undefined, don't update; if empty array, delete it; otherwise update
        if (updates.aliases !== undefined) {
          if (updates.aliases.length === 0) {
            delete updatedData.aliases;
          } else {
            updatedData.aliases = updates.aliases;
          }
        }

        // Only include data field if it has any values
        if (updatedData.displayName || updatedData.color || (updatedData.aliases && updatedData.aliases.length > 0)) {
          updatedNode.data = updatedData;
        } else {
          // Remove data field if empty
          delete (updatedNode as any).data;
        }

        const updatedNodes = [...taxonomy.nodes];
        updatedNodes[nodeIndex] = updatedNode;

        const updatedTaxonomy: Taxonomy = {
          ...taxonomy,
          nodes: updatedNodes,
        };

        const index = buildTaxonomyIndex(updatedTaxonomy);
        set({ taxonomy: updatedTaxonomy, index });
      },

      swapNodeOrder: (nodeId: NodeId, direction: 'up' | 'down') => {
        const { taxonomy, index } = get();
        if (!taxonomy || !index) return;

        const node = index.byId.get(nodeId);
        if (!node) {
          console.warn(`[TagSelector] Node ${nodeId} not found for order swap`);
          return;
        }

        // Get all siblings (same parentId)
        const siblings = index.childrenOf.get(node.parentId) || [];
        if (siblings.length <= 1) {
          // No siblings to swap with
          return;
        }

        // Find current node's index in sorted siblings
        const currentIndex = siblings.indexOf(nodeId);
        if (currentIndex === -1) {
          console.warn(`[TagSelector] Node ${nodeId} not found in siblings`);
          return;
        }

        // Calculate target index
        let targetIndex: number;
        if (direction === 'up') {
          if (currentIndex === 0) {
            // Already at top, cannot move up
            return;
          }
          targetIndex = currentIndex - 1;
        } else {
          // direction === 'down'
          if (currentIndex === siblings.length - 1) {
            // Already at bottom, cannot move down
            return;
          }
          targetIndex = currentIndex + 1;
        }

        const targetNodeId = siblings[targetIndex];
        const targetNode = index.byId.get(targetNodeId);
        if (!targetNode) {
          console.warn(`[TagSelector] Target node ${targetNodeId} not found`);
          return;
        }

        // Swap orders temporarily
        const tempOrder = node.order;
        const targetOrder = targetNode.order;

        // Update nodes with swapped orders
        const updatedNodes = taxonomy.nodes.map((n) => {
          if (n.id === nodeId) {
            return { ...n, order: targetOrder };
          }
          if (n.id === targetNodeId) {
            return { ...n, order: tempOrder };
          }
          return n;
        });

        // Normalize orders for all siblings (0..n-1)
        const normalizedTaxonomy = normalizeOrder({
          ...taxonomy,
          nodes: updatedNodes,
        });

        // Rebuild index
        const newIndex = buildTaxonomyIndex(normalizedTaxonomy);
        set({ taxonomy: normalizedTaxonomy, index: newIndex });
      },

      deleteNode: (nodeId: NodeId) => {
        const { taxonomy, index } = get();
        if (!taxonomy || !index) {
          return { success: false as const, reason: 'not_found' as const };
        }

        const node = index.byId.get(nodeId);
        if (!node) {
          return { success: false as const, reason: 'not_found' as const };
        }

        // For folders, check if empty
        if (node.kind === 'folder') {
          const children = index.childrenOf.get(nodeId) || [];
          if (children.length > 0) {
            return { success: false as const, reason: 'folder_not_empty' as const };
          }
        }

        // Collect all nodes to remove (including descendants recursively)
        const nodesToRemove = new Set<NodeId>([nodeId]);
        const collectDescendants = (parentId: NodeId) => {
          const children = index.childrenOf.get(parentId) || [];
          for (const childId of children) {
            nodesToRemove.add(childId);
            collectDescendants(childId);
          }
        };
        collectDescendants(nodeId);

        // Filter out all nodes to be removed
        const updatedNodes = taxonomy.nodes.filter((n) => !nodesToRemove.has(n.id));

        const updatedTaxonomy: Taxonomy = {
          ...taxonomy,
          nodes: updatedNodes,
        };

        // Rebuild index
        const newIndex = buildTaxonomyIndex(updatedTaxonomy);
        set({ taxonomy: updatedTaxonomy, index: newIndex });

        // Return removed tag IDs for cleanup (selectedIds)
        const removedTagIds = Array.from(nodesToRemove).filter((id) => {
          const n = index.byId.get(id);
          return n && n.kind === 'tag';
        });

        return { success: true as const, removedTagIds };
      },

      createNode: (kind: 'folder' | 'tag', parentId: NodeId | null, defaultLabel: string) => {
        const { taxonomy, index } = get();
        if (!taxonomy || !index) return null;

        // Generate unique ID (f_<8位随机> or t_<8位随机>)
        const generateId = (): NodeId => {
          const prefix = kind === 'folder' ? 'f_' : 't_';
          const random = Math.random().toString(36).slice(2, 10).padEnd(8, '0').slice(0, 8);
          return `${prefix}${random}`;
        };

        let newNodeId: NodeId;
        let attempts = 0;
        do {
          newNodeId = generateId();
          attempts++;
          if (attempts > 100) {
            console.error('[TagSelector] Failed to generate unique ID after 100 attempts');
            return null;
          }
        } while (index.byId.has(newNodeId));

        // Calculate max order among siblings
        const siblings = index.childrenOf.get(parentId) || [];
        let maxOrder = -1;
        for (const siblingId of siblings) {
          const sibling = index.byId.get(siblingId);
          if (sibling && sibling.order > maxOrder) {
            maxOrder = sibling.order;
          }
        }
        const newOrder = maxOrder + 1;

        // Create new node base
        const newNodeBase: TagNode = {
          id: newNodeId,
          label: defaultLabel,
          parentId,
          kind,
          order: newOrder,
        };

        // For tag, add data fields (displayName, aliases, color)
        // Use type assertion to add data field (preserved in JSON but not in TagNode type)
        const newNode = kind === 'tag'
          ? (newNodeBase as TagNode & { data?: { displayName?: string; aliases?: string[]; color?: string } })
          : newNodeBase;

        if (kind === 'tag') {
          (newNode as TagNode & { data?: { displayName?: string; aliases?: string[]; color?: string } }).data = {
            displayName: '',
            aliases: [],
            color: '#3b82f6', // Default blue color
          };
        }

        // Add to taxonomy
        const updatedNodes = [...taxonomy.nodes, newNode];
        const updatedTaxonomy: Taxonomy = {
          ...taxonomy,
          nodes: updatedNodes,
        };

        // Rebuild index
        const newIndex = buildTaxonomyIndex(updatedTaxonomy);
        set({ taxonomy: updatedTaxonomy, index: newIndex });

        return newNodeId;
      },
    }),
    {
      name: 'tagselector-taxonomy',
      partialize: (state) => ({ taxonomy: state.taxonomy }),
      onRehydrateStorage: () => (state) => {
        // Rebuild index after rehydration, but validate first
        if (state?.taxonomy) {
          // Validate the rehydrated taxonomy (防绕过 import 校验)
          const validation = validateTaxonomy(state.taxonomy);
          
          if (!validation.valid) {
            // Log warnings but don't block - UI guards will handle invalid navigation
            console.warn(
              '[TagSelector] Rehydrated taxonomy has validation errors:',
              validation.errors.map((e) => `${e.code}: ${e.message}`)
            );
            
            // Store validation errors for UI display
            state.validationErrors = validation.errors;
            state.error = `Cached taxonomy has ${validation.errors.length} validation error(s). ` +
              `Navigation guards are active. Consider re-importing the taxonomy.`;
          } else {
            state.validationErrors = [];
            state.error = null;
          }
          
          // Always build index so UI can still function (with guards protecting navigation)
          state.index = buildTaxonomyIndex(state.taxonomy);
        }
      },
    }
  )
);
