/**
 * TagSelector Core - Taxonomy Types
 * Version: 1.3.1
 */

import type { TagNode } from './node.js';

/** Current schema version */
export const SCHEMA_VERSION = '1.3.1' as const;

/**
 * A taxonomy container holding all nodes.
 */
export interface Taxonomy {
  /** Schema version for compatibility checking */
  schemaVersion: typeof SCHEMA_VERSION;

  /** All nodes in the taxonomy (flat array) */
  nodes: TagNode[];

  /** Optional metadata */
  meta?: {
    name?: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

