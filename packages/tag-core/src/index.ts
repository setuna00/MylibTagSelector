/**
 * TagSelector Core
 * Version: 1.3.1
 *
 * Pure TypeScript library for tag taxonomy management.
 * No React, no DOM, no storage dependencies.
 */

// Models
export type {
  NodeId,
  NodeKind,
  TagNode,
  Taxonomy,
  TaxonomyIndex,
} from './models/index.js';

export { shouldExport, getRecommendedTagIds, SCHEMA_VERSION } from './models/index.js';

// Operations
export { compareNodes, compareStringsUTF16 } from './ops/compare.js';
export { buildTaxonomyIndex, computeSortPath } from './ops/index-builder.js';
export { computeClosure } from './ops/closure.js';
export { computeExportSet } from './ops/export-set.js';
export type { ExportSetOptions } from './ops/export-set.js';
export { sortByUserOrder } from './ops/sort.js';
export { formatForMylio, DEFAULT_SEPARATOR } from './ops/format.js';
export { normalizeLabel } from './ops/normalize.js';
export { searchNodes } from './ops/search.js';

// IO
export { validateTaxonomy } from './io/schema.js';
export type { ValidationResult, ValidationError, ValidationErrorCode } from './io/schema.js';
export { importTaxonomy } from './io/import.js';
export type { ImportResult } from './io/import.js';
export { exportTaxonomy } from './io/export.js';
export type { ExportOptions } from './io/export.js';
export { initializeOrder, normalizeOrder } from './io/order-utils.js';

