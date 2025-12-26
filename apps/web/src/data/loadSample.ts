/**
 * Load sample taxonomy data
 */

import type { Taxonomy } from '@tagselector/tag-core';

/**
 * Load the default sample taxonomy (taxonomy-clothing.json)
 * Uses fetch to load the JSON file from public/sample-data/
 */
export async function loadSampleTaxonomy(): Promise<Taxonomy> {
  const response = await fetch('/sample-data/taxonomy-clothing.json');
  if (!response.ok) {
    throw new Error(`Failed to load sample taxonomy: ${response.statusText}`);
  }
  return response.json() as Promise<Taxonomy>;
}

