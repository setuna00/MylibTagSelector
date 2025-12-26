/**
 * Project Pack Types
 *
 * Type definitions for taxonomy extensions (meta.extensions).
 * Used for bundled import/export of taxonomy + rules + quickTrees + recommendations.
 *
 * Note: tag-core's Taxonomy.meta does not define extensions field,
 * so we access it via (taxonomy.meta as any)?.extensions at runtime.
 */

import type { NodeId } from '@tagselector/tag-core';
import type { Rule } from '../store/rulesStore';

// ============================================================================
// Quick Trees
// ============================================================================

/**
 * A node in a QuickTree - either a group (container) or a ref (taxonomy node reference).
 */
export type QuickTreeNode =
  | { type: 'group'; id: string; label: string; children: QuickTreeNode[] }
  | { type: 'ref'; refId: NodeId };

/**
 * A user-defined quick tree for fast navigation/selection.
 */
export interface QuickTree {
  id: string;
  name: string;
  roots: QuickTreeNode[];
}

// ============================================================================
// Recommendations Config
// ============================================================================

/**
 * Configuration for the recommendations panel.
 * - historySize: how many recent picks to track (optional, defaults handled by consumer)
 * - limit: max recommendations to show (optional, defaults handled by consumer)
 * - map: manual mapping of tag -> recommended tags
 */
export interface RecommendationsConfig {
  version: 1;
  historySize?: number;
  limit?: number;
  map: Record<NodeId, NodeId[]>;
}

// ============================================================================
// Rules Config (for extensions storage)
// ============================================================================

/**
 * Rules configuration stored in extensions.
 */
export interface RulesConfig {
  version: 1;
  savedRules: Rule[];
}

// ============================================================================
// UI Config
// ============================================================================

/**
 * Configuration for the folder navigator (left panel tree).
 * - mode: 'collapsed' (default), 'expanded' (all open), or 'auto' (autoOpenFolderIds)
 * - autoOpenFolderIds: folder IDs to auto-expand in 'auto' mode
 */
export interface FolderNavigatorConfig {
  version: 1;
  mode?: 'collapsed' | 'expanded' | 'auto';
  autoOpenFolderIds?: NodeId[];
}

/**
 * UI configuration stored in extensions.
 */
export interface UiConfig {
  version: 1;
  folderNavigator?: FolderNavigatorConfig;
}

// ============================================================================
// Taxonomy Extensions
// ============================================================================

/**
 * Extensions stored in taxonomy.meta.extensions.
 * All fields are optional for backward compatibility.
 */
export interface TaxonomyExtensions {
  rules?: RulesConfig;
  quickTrees?: QuickTree[];
  recommendations?: RecommendationsConfig;
  ui?: UiConfig;
}

