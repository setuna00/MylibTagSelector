/**
 * TagSelector Core - Import Taxonomy
 * Version: 1.3.1
 */

import type { Taxonomy } from '../models/taxonomy.js';
import { SCHEMA_VERSION } from '../models/taxonomy.js';
import { validateTaxonomy, type ValidationError } from './schema.js';
import { initializeOrder } from './order-utils.js';

export interface ImportResult {
  success: boolean;
  taxonomy?: Taxonomy;
  errors?: ValidationError[];
}

/**
 * Import a taxonomy from a JSON string.
 *
 * Process:
 * 1. Parse JSON
 * 2. Validate structure
 * 3. Initialize missing order fields
 * 4. Return result
 *
 * @param jsonString - The JSON string to parse
 * @returns Import result with taxonomy or errors
 */
export function importTaxonomy(jsonString: string): ImportResult {
  // Step 1: Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    return {
      success: false,
      errors: [
        {
          path: '',
          message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
          code: 'INVALID_TYPE',
        },
      ],
    };
  }

  // Step 2: Validate
  const validation = validateTaxonomy(data);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // Step 3: Initialize order for nodes missing it
  let taxonomy = data as Taxonomy;

  // Ensure schemaVersion is set
  if (!taxonomy.schemaVersion) {
    taxonomy = { ...taxonomy, schemaVersion: SCHEMA_VERSION };
  }

  // Initialize missing order fields
  taxonomy = initializeOrder(taxonomy);

  return {
    success: true,
    taxonomy,
  };
}

