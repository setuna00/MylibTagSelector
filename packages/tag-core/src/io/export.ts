/**
 * TagSelector Core - Export Taxonomy
 * Version: 1.3.1
 */

import type { Taxonomy } from '../models/taxonomy.js';

export interface ExportOptions {
  /** Pretty print JSON. Default: true */
  pretty?: boolean;
  /** Include updated timestamp in meta. Default: false */
  includeMetaTimestamp?: boolean;
}

/**
 * Export a taxonomy to a JSON string.
 *
 * @param taxonomy - The taxonomy to export
 * @param options - Export options
 * @returns JSON string
 */
export function exportTaxonomy(
  taxonomy: Taxonomy,
  options: ExportOptions = {}
): string {
  const { pretty = true, includeMetaTimestamp = false } = options;

  let output = taxonomy;

  if (includeMetaTimestamp) {
    output = {
      ...taxonomy,
      meta: {
        ...taxonomy.meta,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  if (pretty) {
    return JSON.stringify(output, null, 2);
  }

  return JSON.stringify(output);
}

