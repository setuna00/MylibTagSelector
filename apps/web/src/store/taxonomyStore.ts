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
import type { Taxonomy, TaxonomyIndex } from '@tagselector/tag-core';
import {
  buildTaxonomyIndex,
  importTaxonomy,
  exportTaxonomy,
  validateTaxonomy,
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
