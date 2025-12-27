/**
 * Selection Store
 *
 * Manages the user's tag selection.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NodeId, TaxonomyIndex } from '@tagselector/tag-core';

interface SelectionState {
  selectedIds: Set<NodeId>;
}

interface SelectionActions {
  toggle: (nodeId: NodeId) => void;
  select: (nodeId: NodeId) => void;
  deselect: (nodeId: NodeId) => void;
  clear: () => void;
  setSelection: (nodeIds: NodeId[]) => void;
  /**
   * Add multiple tags to selection in a single update.
   * Used for batch operations to avoid multiple state updates.
   */
  addMany: (nodeIds: NodeId[]) => void;
  /**
   * Remove invalid node IDs from selection.
   * Called when taxonomy/index changes to ensure selectedIds only contains valid IDs.
   * Logic matches original App.tsx cleanup useEffect exactly.
   */
  cleanupInvalidSelection: (index: TaxonomyIndex | null) => void;
}

export const useSelectionStore = create<SelectionState & SelectionActions>()(
  persist(
    (set) => ({
      selectedIds: new Set<NodeId>(),

      toggle: (nodeId: NodeId) => {
        set((state) => {
          const newSet = new Set(state.selectedIds);
          if (newSet.has(nodeId)) {
            newSet.delete(nodeId);
          } else {
            newSet.add(nodeId);
          }
          return { selectedIds: newSet };
        });
      },

      select: (nodeId: NodeId) => {
        set((state) => {
          const newSet = new Set(state.selectedIds);
          newSet.add(nodeId);
          return { selectedIds: newSet };
        });
      },

      deselect: (nodeId: NodeId) => {
        set((state) => {
          const newSet = new Set(state.selectedIds);
          newSet.delete(nodeId);
          return { selectedIds: newSet };
        });
      },

      clear: () => {
        set({ selectedIds: new Set() });
      },

      setSelection: (nodeIds: NodeId[]) => {
        set({ selectedIds: new Set(nodeIds) });
      },

      addMany: (nodeIds: NodeId[]) => {
        set((state) => {
          const newSet = new Set(state.selectedIds);
          let changed = false;
          for (const nodeId of nodeIds) {
            if (!newSet.has(nodeId)) {
              newSet.add(nodeId);
              changed = true;
            }
          }
          // Avoid triggering re-renders when nothing changes
          return changed ? { selectedIds: newSet } : state;
        });
      },

      cleanupInvalidSelection: (index: TaxonomyIndex | null) => {
        // Skip if no index (taxonomy not loaded yet)
        if (!index) return;

        set((state) => {
          // Skip if selection is empty
          if (state.selectedIds.size === 0) return state;

          // Calculate intersection: only keep ids that exist in current index
          const validIds = Array.from(state.selectedIds).filter(id => index.byId.has(id));

          // Only update if some invalid ids were removed
          if (validIds.length === state.selectedIds.size) return state;

          return { selectedIds: new Set(validIds) };
        });
      },
    }),
    {
      name: 'tagselector-selection',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          return {
            ...data,
            state: {
              ...data.state,
              selectedIds: new Set(data.state.selectedIds || []),
            },
          };
        },
        setItem: (name, value) => {
          const data = {
            ...value,
            state: {
              ...value.state,
              selectedIds: Array.from(value.state.selectedIds),
            },
          };
          localStorage.setItem(name, JSON.stringify(data));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
