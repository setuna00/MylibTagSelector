/**
 * TagSelector Core - Schema Validation
 * Version: 1.3.1
 */

import type { NodeId, TagNode } from '../models/node.js';
import { SCHEMA_VERSION } from '../models/taxonomy.js';

export type ValidationErrorCode =
  | 'INVALID_TYPE'
  | 'MISSING_FIELD'
  | 'DUPLICATE_ID'
  | 'ORPHAN_NODE'
  | 'FORBIDDEN_CHAR'
  | 'INVALID_ORDER'
  | 'INVALID_KIND'
  | 'CIRCULAR_REF'
  | 'INVALID_SCHEMA_VERSION'
  | 'TAG_HAS_CHILDREN';

export interface ValidationError {
  path: string;
  message: string;
  code: ValidationErrorCode;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation options for validateTaxonomy.
 */
export interface ValidationOptions {
  /**
   * Enforce tag leaf rule: tags cannot have children.
   * When enabled, reports TAG_HAS_CHILDREN error for any tag node that has children.
   * Default: true
   */
  enforceTagLeaf?: boolean;
}

/**
 * Validate a taxonomy data structure.
 *
 * Checks:
 * - Schema version compatibility
 * - Required fields present
 * - No duplicate IDs
 * - No orphan nodes (invalid parentId)
 * - No circular references
 * - Labels don't contain forbidden characters (comma)
 * - order is a valid integer
 * - kind is 'folder' or 'tag'
 * - (Optional) Tags cannot have children (enforceTagLeaf)
 */
export function validateTaxonomy(
  data: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const { enforceTagLeaf = true } = options;
  const errors: ValidationError[] = [];

  // Check basic structure
  if (!data || typeof data !== 'object') {
    errors.push({
      path: '',
      message: 'Taxonomy must be an object',
      code: 'INVALID_TYPE',
    });
    return { valid: false, errors };
  }

  const obj = data as Record<string, unknown>;

  // Check schemaVersion
  if (!obj.schemaVersion) {
    errors.push({
      path: 'schemaVersion',
      message: 'Missing schemaVersion',
      code: 'MISSING_FIELD',
    });
  } else if (typeof obj.schemaVersion !== 'string') {
    errors.push({
      path: 'schemaVersion',
      message: 'schemaVersion must be a string',
      code: 'INVALID_TYPE',
    });
  } else {
    // Allow compatible versions (same major.minor)
    const [major, minor] = obj.schemaVersion.split('.').map(Number);
    const [expectedMajor, expectedMinor] = SCHEMA_VERSION.split('.').map(Number);
    if (major !== expectedMajor || minor !== expectedMinor) {
      errors.push({
        path: 'schemaVersion',
        message: `Incompatible schema version: ${obj.schemaVersion}, expected ${SCHEMA_VERSION}`,
        code: 'INVALID_SCHEMA_VERSION',
      });
    }
  }

  // Check nodes array
  if (!obj.nodes) {
    errors.push({
      path: 'nodes',
      message: 'Missing nodes array',
      code: 'MISSING_FIELD',
    });
    return { valid: false, errors };
  }

  if (!Array.isArray(obj.nodes)) {
    errors.push({
      path: 'nodes',
      message: 'nodes must be an array',
      code: 'INVALID_TYPE',
    });
    return { valid: false, errors };
  }

  const nodes = obj.nodes as unknown[];
  const nodeIds = new Set<NodeId>();
  const nodeMap = new Map<NodeId, TagNode>();

  // Validate each node
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const path = `nodes[${i}]`;

    if (!node || typeof node !== 'object') {
      errors.push({
        path,
        message: 'Node must be an object',
        code: 'INVALID_TYPE',
      });
      continue;
    }

    const n = node as Record<string, unknown>;

    // Check required fields
    if (typeof n.id !== 'string' || !n.id) {
      errors.push({
        path: `${path}.id`,
        message: 'id must be a non-empty string',
        code: 'MISSING_FIELD',
      });
      continue;
    }

    if (typeof n.label !== 'string') {
      errors.push({
        path: `${path}.label`,
        message: 'label must be a string',
        code: 'MISSING_FIELD',
      });
    }

    // Check for duplicate IDs
    if (nodeIds.has(n.id)) {
      errors.push({
        path: `${path}.id`,
        message: `Duplicate node ID: ${n.id}`,
        code: 'DUPLICATE_ID',
      });
    } else {
      nodeIds.add(n.id);
    }

    // Check parentId (null or string)
    if (n.parentId !== null && typeof n.parentId !== 'string') {
      errors.push({
        path: `${path}.parentId`,
        message: 'parentId must be null or a string',
        code: 'INVALID_TYPE',
      });
    }

    // Check kind
    if (n.kind !== 'folder' && n.kind !== 'tag') {
      errors.push({
        path: `${path}.kind`,
        message: 'kind must be "folder" or "tag"',
        code: 'INVALID_KIND',
      });
    }

    // Check order
    if (typeof n.order !== 'number' || !Number.isInteger(n.order)) {
      // Allow missing order (will be auto-initialized)
      if (n.order !== undefined) {
        errors.push({
          path: `${path}.order`,
          message: 'order must be an integer',
          code: 'INVALID_ORDER',
        });
      }
    }

    // Check label for forbidden characters
    if (typeof n.label === 'string' && n.label.includes(',')) {
      errors.push({
        path: `${path}.label`,
        message: 'label must not contain comma',
        code: 'FORBIDDEN_CHAR',
      });
    }

    nodeMap.set(n.id, node as TagNode);
  }

  // Check for orphan nodes (parentId points to non-existent node)
  for (const [id, node] of nodeMap) {
    if (node.parentId !== null && !nodeMap.has(node.parentId)) {
      errors.push({
        path: `nodes[${id}].parentId`,
        message: `Orphan node: parentId "${node.parentId}" does not exist`,
        code: 'ORPHAN_NODE',
      });
    }
  }

  // Check for circular references
  for (const [startId] of nodeMap) {
    const visited = new Set<NodeId>();
    let currentId: NodeId | null = startId;

    while (currentId !== null) {
      if (visited.has(currentId)) {
        errors.push({
          path: `nodes[${startId}]`,
          message: `Circular reference detected involving node: ${currentId}`,
          code: 'CIRCULAR_REF',
        });
        break;
      }
      visited.add(currentId);
      const node = nodeMap.get(currentId);
      currentId = node?.parentId ?? null;
    }
  }

  // Check for tags with children (enforceTagLeaf rule)
  // Enhanced error reporting: report each child->parent violation with child details
  if (enforceTagLeaf) {
    // Build childrenOf map to check which nodes have children
    const childrenOf = new Map<NodeId | null, NodeId[]>();
    for (const [id, node] of nodeMap) {
      const parentId = node.parentId;
      if (!childrenOf.has(parentId)) {
        childrenOf.set(parentId, []);
      }
      childrenOf.get(parentId)!.push(id);
    }

    // Check each tag node for children - report EACH child for better error localization
    for (const [id, node] of nodeMap) {
      if (node.kind === 'tag') {
        const children = childrenOf.get(id);
        if (children && children.length > 0) {
          // Report each child separately for precise error localization
          for (const childId of children) {
            const childNode = nodeMap.get(childId);
            const childLabel = childNode?.label ?? '(unknown)';
            errors.push({
              path: `nodes[${childId}]`,
              message: `Node "${childLabel}" (id: ${childId}) has parent tag "${node.label}" (id: ${id}). ` +
                `Tags cannot have children. Either change parent to a folder, or change parent's kind to 'folder'.`,
              code: 'TAG_HAS_CHILDREN',
            });
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
