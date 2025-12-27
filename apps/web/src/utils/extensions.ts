/**
 * Extensions Utilities
 *
 * Utilities for reading/writing taxonomy.meta.extensions.
 * Since tag-core's Taxonomy.meta does not define extensions field,
 * we access it via safe runtime checks.
 */

import type { Taxonomy } from '@tagselector/tag-core';
import type { TaxonomyExtensions } from '../types/project-pack';

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null;
}

function getExtensionsObject(taxonomy: Taxonomy): UnknownRecord {
  const meta = taxonomy.meta as unknown;
  if (!isRecord(meta)) return {};
  const raw = meta['extensions'];
  return isRecord(raw) ? raw : {};
}

/**
 * Get extensions from taxonomy with defaults.
 *
 * @param taxonomy - The taxonomy to read extensions from
 * @returns Extensions with all required fields (using defaults for missing values)
 */
export function getExtensions(taxonomy: Taxonomy): Required<TaxonomyExtensions> {
  const ext = getExtensionsObject(taxonomy);

  const rules = isRecord(ext['rules']) ? (ext['rules'] as TaxonomyExtensions['rules']) : undefined;
  const quickTrees = Array.isArray(ext['quickTrees'])
    ? (ext['quickTrees'] as TaxonomyExtensions['quickTrees'])
    : undefined;
  const recommendations = isRecord(ext['recommendations'])
    ? (ext['recommendations'] as TaxonomyExtensions['recommendations'])
    : undefined;
  const ui = isRecord(ext['ui']) ? (ext['ui'] as TaxonomyExtensions['ui']) : undefined;

  return {
    rules: rules ?? { version: 1, savedRules: [] },
    quickTrees: quickTrees ?? [],
    recommendations: recommendations ?? { version: 1, map: {} },
    ui: ui ?? {
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
  const existingExt = getExtensionsObject(taxonomy);

  const mergedExtensions: TaxonomyExtensions = {
    ...(existingExt as TaxonomyExtensions),
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

