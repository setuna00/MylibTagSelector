/**
 * Extensions Utilities
 *
 * Utilities for reading/writing taxonomy.meta.extensions.
 * Since tag-core's Taxonomy.meta does not define extensions field,
 * we use (taxonomy.meta as any)?.extensions to access it.
 */

import type { Taxonomy } from '@tagselector/tag-core';
import type { TaxonomyExtensions } from '../types/project-pack';

/**
 * Get extensions from taxonomy with defaults.
 *
 * @param taxonomy - The taxonomy to read extensions from
 * @returns Extensions with all required fields (using defaults for missing values)
 */
export function getExtensions(taxonomy: Taxonomy): Required<TaxonomyExtensions> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ext = (taxonomy.meta as any)?.extensions ?? {};

  return {
    rules: ext.rules ?? { version: 1, savedRules: [] },
    quickTrees: ext.quickTrees ?? [],
    recommendations: ext.recommendations ?? { version: 1, map: {} },
    ui: ext.ui ?? {
      version: 1,
      folderNavigator: { version: 1, mode: 'collapsed', autoOpenFolderIds: [] },
    },
  };
}

/**
 * Inject extensions into a taxonomy (immutable).
 * Creates a new taxonomy object with merged extensions.
 *
 * @param taxonomy - The original taxonomy
 * @param partial - Partial extensions to merge
 * @returns New taxonomy with merged extensions
 */
export function injectExtensions(
  taxonomy: Taxonomy,
  partial: Partial<TaxonomyExtensions>
): Taxonomy {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingExt = (taxonomy.meta as any)?.extensions ?? {};

  const mergedExtensions: TaxonomyExtensions = {
    ...existingExt,
    ...partial,
  };

  return {
    ...taxonomy,
    meta: {
      ...taxonomy.meta,
      extensions: mergedExtensions,
    },
  };
}

