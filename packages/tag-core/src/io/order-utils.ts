/**
 * TagSelector Core - Order Utilities
 * Version: 1.3.1
 *
 * Utilities for handling order field in taxonomy.
 */

import type { TagNode, NodeId } from '../models/node.js';
import type { Taxonomy } from '../models/taxonomy.js';

/**
 * Initialize missing order fields in a taxonomy.
 *
 * For nodes without an order field, assigns order based on their
 * position among siblings (0, 1, 2, ...).
 *
 * @param taxonomy - The taxonomy to process
 * @returns A new taxonomy with all order fields initialized
 */
export function initializeOrder(taxonomy: Taxonomy): Taxonomy {
  // Group nodes by parent
  const byParent = new Map<NodeId | null, TagNode[]>();
  for (const node of taxonomy.nodes) {
    const parentId = node.parentId;
    if (!byParent.has(parentId)) {
      byParent.set(parentId, []);
    }
    byParent.get(parentId)!.push(node);
  }

  // Process each group and assign order to nodes missing it
  const updatedNodes: TagNode[] = [];

  for (const node of taxonomy.nodes) {
    if (node.order === undefined || node.order === null) {
      // Find position among siblings
      const siblings = byParent.get(node.parentId) || [];
      const index = siblings.indexOf(node);
      updatedNodes.push({
        ...node,
        order: index >= 0 ? index : 0,
      });
    } else {
      updatedNodes.push(node);
    }
  }

  return {
    ...taxonomy,
    nodes: updatedNodes,
  };
}

/**
 * Normalize order fields to be consecutive integers starting from 0.
 *
 * For each parent, sorts children by their current order and reassigns
 * consecutive order values (0, 1, 2, ...).
 *
 * @param taxonomy - The taxonomy to normalize
 * @returns A new taxonomy with normalized order fields
 */
export function normalizeOrder(taxonomy: Taxonomy): Taxonomy {
  // Group nodes by parent
  const byParent = new Map<NodeId | null, TagNode[]>();
  const nodeMap = new Map<NodeId, TagNode>();

  for (const node of taxonomy.nodes) {
    nodeMap.set(node.id, node);
    const parentId = node.parentId;
    if (!byParent.has(parentId)) {
      byParent.set(parentId, []);
    }
    byParent.get(parentId)!.push(node);
  }

  // Sort each group and assign consecutive order
  const orderMap = new Map<NodeId, number>();

  for (const [, siblings] of byParent) {
    // Sort by current order
    siblings.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    // Assign consecutive order
    siblings.forEach((node, index) => {
      orderMap.set(node.id, index);
    });
  }

  // Create updated nodes
  const updatedNodes = taxonomy.nodes.map((node) => ({
    ...node,
    order: orderMap.get(node.id) ?? node.order ?? 0,
  }));

  return {
    ...taxonomy,
    nodes: updatedNodes,
  };
}

