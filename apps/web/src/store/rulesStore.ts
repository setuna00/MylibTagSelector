/**
 * Rules Store
 *
 * Manages tag relationship rules with Draft + Save model.
 * 
 * Key Concepts:
 * - savedRules: Persisted rules that are enforced at runtime
 * - draftRules: Working copy being edited (not persisted until Save)
 * - Edit operations modify draftRules only
 * - Save validates and commits draftRules to savedRules
 * 
 * Runtime Enforcement (when drawer is closed):
 * - REQUIRES: Auto-add missing targets to selection
 * - EXCLUDES: Hide/disable targets in picker
 * 
 * Editing Mode (when drawer is open):
 * - Runtime enforcement is paused
 * - User can see all tags to configure rules
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NodeId, TaxonomyIndex } from '@tagselector/tag-core';

// ============================================================================
// Types
// ============================================================================

/** Rule type: what relationship exists between trigger and targets */
export type RuleType = 'EXCLUDES' | 'REQUIRES';

/** Edit mode for rules panel */
export type RuleEditMode = 'idle' | 'selecting-trigger' | 'selecting-targets';

/** A single rule */
export interface Rule {
  /** Unique identifier */
  id: string;
  /** User-editable name */
  name: string;
  /** Trigger tag ID (A). Null if not set. */
  triggerTagId: NodeId | null;
  /** Rule type: EXCLUDES or REQUIRES */
  type: RuleType;
  /** Target tag IDs (B, C, D...) */
  targetTagIds: NodeId[];
}

/** Validation error with enough info for UI display */
export interface RuleValidationError {
  /** Error type for categorization */
  errorType: 
    | 'EMPTY_NAME'
    | 'NO_TRIGGER'
    | 'TRIGGER_NOT_TAG'
    | 'NO_TARGETS'
    | 'TARGET_NOT_TAG'
    | 'TRIGGER_IN_TARGETS'
    | 'CONFLICT_REQUIRES_EXCLUDES'
    | 'UNSATISFIABLE'
    | 'TRIGGER_MISSING'
    | 'TARGET_MISSING';
  /** Rule ID */
  ruleId: string;
  /** Rule name (for display) */
  ruleName: string;
  /** Trigger tag label (if applicable) */
  triggerLabel?: string;
  /** Related target labels (if applicable) */
  targetLabels?: string[];
  /** Human-readable error message */
  message: string;
}

/** Validation warning (non-blocking) */
export interface RuleValidationWarning {
  /** Warning type */
  warningType: 'CROSS_TRIGGER_CONFLICT';
  /** Related trigger labels */
  triggerLabels: string[];
  /** Conflicting tag labels */
  conflictLabels: string[];
  /** Human-readable warning message */
  message: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Get tag label from index, or null if not found.
 */
function getTagLabel(index: TaxonomyIndex, tagId: NodeId): string | null {
  const node = index.byId.get(tagId);
  return node?.label ?? null;
}

/**
 * Check if a node is a tag (not a folder).
 */
function isTag(index: TaxonomyIndex, nodeId: NodeId): boolean {
  const node = index.byId.get(nodeId);
  return node?.kind === 'tag';
}

/**
 * Compute the REQUIRES closure for a trigger.
 * Returns all tags that must be selected if the trigger is selected.
 * Handles transitive REQUIRES (A REQUIRES B, B REQUIRES C => A requires {A, B, C}).
 */
function computeRequiresClosure(
  triggerId: NodeId,
  rules: Rule[]
): Set<NodeId> {
  const closure = new Set<NodeId>([triggerId]);
  const queue = [triggerId];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    // Find all REQUIRES rules where current is the trigger
    for (const rule of rules) {
      if (rule.type === 'REQUIRES' && rule.triggerTagId === current) {
        for (const targetId of rule.targetTagIds) {
          if (!closure.has(targetId)) {
            closure.add(targetId);
            queue.push(targetId);
          }
        }
      }
    }
  }
  
  return closure;
}

/**
 * Get all tags that a given trigger excludes (directly, not transitively).
 */
function getExcludedTags(triggerId: NodeId, rules: Rule[]): Set<NodeId> {
  const excluded = new Set<NodeId>();
  
  for (const rule of rules) {
    if (rule.type === 'EXCLUDES' && rule.triggerTagId === triggerId) {
      for (const targetId of rule.targetTagIds) {
        excluded.add(targetId);
      }
    }
  }
  
  return excluded;
}

/**
 * Validate rules and return list of errors and warnings.
 * Returns empty arrays if all rules are valid.
 */
export function validateRules(
  rules: Rule[],
  index: TaxonomyIndex | null
): { errors: RuleValidationError[]; warnings: RuleValidationWarning[] } {
  const errors: RuleValidationError[] = [];
  const warnings: RuleValidationWarning[] = [];
  
  if (!index) return { errors, warnings };
  
  // ========== Per-Rule Validation ==========
  for (const rule of rules) {
    // 1. Name must be non-empty
    if (!rule.name.trim()) {
      errors.push({
        errorType: 'EMPTY_NAME',
        ruleId: rule.id,
        ruleName: rule.name || '(unnamed)',
        message: '规则名称不能为空',
      });
    }
    
    // 2. Trigger must be set
    if (!rule.triggerTagId) {
      errors.push({
        errorType: 'NO_TRIGGER',
        ruleId: rule.id,
        ruleName: rule.name,
        message: '未设置触发标签',
      });
      continue; // Can't do more validation without trigger
    }
    
    // 3. Trigger must exist in index (missing tag check)
    if (!index.byId.has(rule.triggerTagId)) {
      errors.push({
        errorType: 'TRIGGER_MISSING',
        ruleId: rule.id,
        ruleName: rule.name,
        triggerLabel: rule.triggerTagId,
        message: `触发标签 "${rule.triggerTagId}" 不存在（可能已被删除）`,
      });
      continue; // Can't do more validation with missing trigger
    }
    
    // 4. Trigger must be a tag (not folder)
    if (!isTag(index, rule.triggerTagId)) {
      const node = index.byId.get(rule.triggerTagId);
      errors.push({
        errorType: 'TRIGGER_NOT_TAG',
        ruleId: rule.id,
        ruleName: rule.name,
        triggerLabel: node?.label ?? rule.triggerTagId,
        message: `触发项 "${node?.label ?? rule.triggerTagId}" 不是标签（是文件夹）`,
      });
    }
    
    // 5. Must have at least one target
    if (rule.targetTagIds.length === 0) {
      errors.push({
        errorType: 'NO_TARGETS',
        ruleId: rule.id,
        ruleName: rule.name,
        triggerLabel: getTagLabel(index, rule.triggerTagId) ?? rule.triggerTagId,
        message: '未设置目标标签',
      });
      continue;
    }
    
    // 6. Check for missing targets
    const missingTargets: string[] = [];
    const invalidTargets: string[] = [];
    for (const targetId of rule.targetTagIds) {
      if (!index.byId.has(targetId)) {
        missingTargets.push(targetId);
      } else if (!isTag(index, targetId)) {
        const node = index.byId.get(targetId);
        invalidTargets.push(node?.label ?? targetId);
      }
    }
    if (missingTargets.length > 0) {
      errors.push({
        errorType: 'TARGET_MISSING',
        ruleId: rule.id,
        ruleName: rule.name,
        triggerLabel: getTagLabel(index, rule.triggerTagId) ?? rule.triggerTagId,
        targetLabels: missingTargets,
        message: `目标标签不存在（可能已被删除）: ${missingTargets.join(', ')}`,
      });
    }
    if (invalidTargets.length > 0) {
      errors.push({
        errorType: 'TARGET_NOT_TAG',
        ruleId: rule.id,
        ruleName: rule.name,
        triggerLabel: getTagLabel(index, rule.triggerTagId) ?? rule.triggerTagId,
        targetLabels: invalidTargets,
        message: `目标项包含非标签: ${invalidTargets.join(', ')}`,
      });
    }
    
    // 7. Trigger should not be in targets (cleaner semantics)
    if (rule.targetTagIds.includes(rule.triggerTagId)) {
      errors.push({
        errorType: 'TRIGGER_IN_TARGETS',
        ruleId: rule.id,
        ruleName: rule.name,
        triggerLabel: getTagLabel(index, rule.triggerTagId) ?? rule.triggerTagId,
        message: '触发标签不应包含在目标标签中',
      });
    }
  }
  
  // ========== Cross-Rule Conflict Detection ==========
  
  // Build maps: trigger -> (required tags, excluded tags)
  const triggerRequires = new Map<NodeId, Set<NodeId>>();
  const triggerExcludes = new Map<NodeId, Set<NodeId>>();
  
  for (const rule of rules) {
    if (!rule.triggerTagId || rule.targetTagIds.length === 0) continue;
    
    const trigger = rule.triggerTagId;
    
    if (rule.type === 'REQUIRES') {
      if (!triggerRequires.has(trigger)) {
        triggerRequires.set(trigger, new Set());
      }
      for (const t of rule.targetTagIds) {
        triggerRequires.get(trigger)!.add(t);
      }
    } else {
      if (!triggerExcludes.has(trigger)) {
        triggerExcludes.set(trigger, new Set());
      }
      for (const t of rule.targetTagIds) {
        triggerExcludes.get(trigger)!.add(t);
      }
    }
  }
  
  // 8. Direct conflict: A REQUIRES B AND A EXCLUDES B
  for (const [trigger, requires] of triggerRequires) {
    const excludes = triggerExcludes.get(trigger);
    if (!excludes) continue;
    
    const conflicts = [...requires].filter(t => excludes.has(t));
    if (conflicts.length > 0) {
      const triggerLabel = getTagLabel(index, trigger) ?? trigger;
      const conflictLabels = conflicts.map(t => getTagLabel(index, t) ?? t);
      
      errors.push({
        errorType: 'CONFLICT_REQUIRES_EXCLUDES',
        ruleId: '', // Cross-rule error
        ruleName: `[冲突]`,
        triggerLabel,
        targetLabels: conflictLabels,
        message: `"${triggerLabel}" 同时 REQUIRES 和 EXCLUDES: ${conflictLabels.join(', ')}`,
      });
    }
  }
  
  // 9. Unsatisfiable: closure contains conflicting tags
  // For each trigger, compute REQUIRES closure and check for conflicts
  const validRules = rules.filter(r => r.triggerTagId && r.targetTagIds.length > 0);
  const allTriggers = new Set<NodeId>();
  for (const rule of validRules) {
    if (rule.triggerTagId) allTriggers.add(rule.triggerTagId);
  }
  
  for (const trigger of allTriggers) {
    const closure = computeRequiresClosure(trigger, validRules);
    
    // For each tag in closure, check if any of its EXCLUDES hits another closure member
    for (const closureMember of closure) {
      const excluded = getExcludedTags(closureMember, validRules);
      
      const conflictsInClosure = [...excluded].filter(e => closure.has(e));
      if (conflictsInClosure.length > 0) {
        const triggerLabel = getTagLabel(index, trigger) ?? trigger;
        const memberLabel = getTagLabel(index, closureMember) ?? closureMember;
        const conflictLabels = conflictsInClosure.map(t => getTagLabel(index, t) ?? t);
        
        errors.push({
          errorType: 'UNSATISFIABLE',
          ruleId: '',
          ruleName: '[不可满足]',
          triggerLabel,
          targetLabels: conflictLabels,
          message: `选择 "${triggerLabel}" 不可满足: 必选 "${memberLabel}" 会排除 ${conflictLabels.join(', ')} (也在必选链中)`,
        });
        break; // One error per trigger is enough
      }
    }
  }
  
  // 10. Cross-trigger conflict detection (warning, not error)
  // Check if selecting two different triggers could lead to conflicts
  const validRulesForWarnings = rules.filter(r => 
    r.triggerTagId && 
    r.targetTagIds.length > 0 && 
    index.byId.has(r.triggerTagId) &&
    r.targetTagIds.every(t => index.byId.has(t))
  );
  
  const triggerClosures = new Map<NodeId, Set<NodeId>>();
  for (const rule of validRulesForWarnings) {
    if (rule.triggerTagId && !triggerClosures.has(rule.triggerTagId)) {
      triggerClosures.set(rule.triggerTagId, computeRequiresClosure(rule.triggerTagId, validRulesForWarnings));
    }
  }
  
  // Build EXCLUDES bidirectional map for conflict detection
  const excludesMap = new Map<NodeId, Set<NodeId>>();
  for (const rule of validRulesForWarnings) {
    if (rule.type === 'EXCLUDES' && rule.triggerTagId) {
      for (const targetId of rule.targetTagIds) {
        // Bidirectional: A EXCLUDES B means both directions
        if (!excludesMap.has(rule.triggerTagId)) {
          excludesMap.set(rule.triggerTagId, new Set());
        }
        if (!excludesMap.has(targetId)) {
          excludesMap.set(targetId, new Set());
        }
        excludesMap.get(rule.triggerTagId)!.add(targetId);
        excludesMap.get(targetId)!.add(rule.triggerTagId);
      }
    }
  }
  
  // Check all pairs of triggers for potential conflicts
  const triggerArray = Array.from(triggerClosures.keys());
  for (let i = 0; i < triggerArray.length; i++) {
    for (let j = i + 1; j < triggerArray.length; j++) {
      const triggerA = triggerArray[i];
      const triggerB = triggerArray[j];
      const closureA = triggerClosures.get(triggerA)!;
      const closureB = triggerClosures.get(triggerB)!;
      
      // Check if any tag in closureA excludes any tag in closureB (or vice versa)
      const conflicts: { tagA: NodeId; tagB: NodeId }[] = [];
      for (const tagA of closureA) {
        const excludesA = excludesMap.get(tagA);
        if (excludesA) {
          for (const tagB of closureB) {
            if (excludesA.has(tagB)) {
              conflicts.push({ tagA, tagB });
            }
          }
        }
      }
      
      if (conflicts.length > 0) {
        const triggerALabel = getTagLabel(index, triggerA) ?? triggerA;
        const triggerBLabel = getTagLabel(index, triggerB) ?? triggerB;
        const conflictLabels = conflicts.map(c => {
          const labelA = getTagLabel(index, c.tagA) ?? c.tagA;
          const labelB = getTagLabel(index, c.tagB) ?? c.tagB;
          return `${labelA} ⊘ ${labelB}`;
        });
        
        warnings.push({
          warningType: 'CROSS_TRIGGER_CONFLICT',
          triggerLabels: [triggerALabel, triggerBLabel],
          conflictLabels,
          message: `同时选择 "${triggerALabel}" 和 "${triggerBLabel}" 可能导致冲突: ${conflictLabels.join(', ')}`,
        });
      }
    }
  }
  
  return { errors, warnings };
}

// ============================================================================
// Runtime Enforcement Helpers
// ============================================================================

/**
 * Compute what tags should be auto-added given current selection and saved rules.
 * Returns the set of tags to add (excluding already selected).
 */
export function computeRequiredTags(
  selectedIds: Set<NodeId>,
  savedRules: Rule[]
): Set<NodeId> {
  const toAdd = new Set<NodeId>();
  
  // For each selected tag, compute its REQUIRES closure
  for (const selectedId of selectedIds) {
    const closure = computeRequiresClosure(selectedId, savedRules);
    for (const required of closure) {
      if (!selectedIds.has(required)) {
        toAdd.add(required);
      }
    }
  }
  
  return toAdd;
}

/**
 * Compute what tags should be hidden/disabled given current selection and saved rules.
 * Returns the set of excluded tag IDs.
 * 
 * EXCLUDES is BIDIRECTIONAL (mutual exclusion):
 * - If A EXCLUDES B and A is selected → hide B
 * - If A EXCLUDES B and B is selected → hide A (reverse direction)
 */
export function computeExcludedTags(
  selectedIds: Set<NodeId>,
  savedRules: Rule[]
): Set<NodeId> {
  const excluded = new Set<NodeId>();
  
  // Build reverse mapping: target -> triggers that exclude it
  // This allows us to check "if B is selected, which triggers should be hidden?"
  const reverseExcludes = new Map<NodeId, Set<NodeId>>();
  for (const rule of savedRules) {
    if (rule.type === 'EXCLUDES' && rule.triggerTagId) {
      for (const targetId of rule.targetTagIds) {
        if (!reverseExcludes.has(targetId)) {
          reverseExcludes.set(targetId, new Set());
        }
        reverseExcludes.get(targetId)!.add(rule.triggerTagId);
      }
    }
  }
  
  for (const selectedId of selectedIds) {
    // Forward direction: A selected → hide A's EXCLUDES targets
    const tagExcludes = getExcludedTags(selectedId, savedRules);
    for (const ex of tagExcludes) {
      excluded.add(ex);
    }
    
    // Reverse direction: B selected → hide triggers that EXCLUDE B
    const triggersExcludingThis = reverseExcludes.get(selectedId);
    if (triggersExcludingThis) {
      for (const trigger of triggersExcludingThis) {
        excluded.add(trigger);
      }
    }
  }
  
  return excluded;
}

// ============================================================================
// Store State & Actions
// ============================================================================

interface RulesState {
  /** Persisted rules (enforced at runtime) */
  savedRules: Rule[];
  /** Draft rules being edited (not persisted) */
  draftRules: Rule[];
  /** Whether rules panel is open */
  isPanelOpen: boolean;
  /** Currently editing rule ID */
  editingRuleId: string | null;
  /** Current edit mode */
  editMode: RuleEditMode;
  /** Validation errors from last save attempt */
  validationErrors: RuleValidationError[];
  /** Validation warnings from last save attempt (non-blocking) */
  validationWarnings: RuleValidationWarning[];
}

interface RulesActions {
  // Panel controls
  openPanel: () => void;
  closePanel: (force?: boolean) => boolean; // Returns false if blocked by unsaved changes
  
  // Edit mode controls
  startEditingTrigger: (ruleId: string) => void;
  startEditingTargets: (ruleId: string) => void;
  stopEditing: () => void;
  
  // Draft operations (only modify draftRules)
  createRule: (partial?: Partial<Omit<Rule, 'id'>>) => string;
  deleteRule: (id: string) => void;
  renameRule: (id: string, name: string) => void;
  setRuleType: (id: string, type: RuleType) => void;
  setTriggerTag: (id: string, tagId: NodeId | null) => void;
  addTargets: (id: string, tagIds: NodeId[]) => void;
  removeTarget: (id: string, tagId: NodeId) => void;
  clearTargets: (id: string) => void;
  
  // Save/Discard
  saveRules: (index: TaxonomyIndex | null) => boolean; // Returns true if save succeeded
  discardChanges: () => void;
  
  // Helpers
  hasUnsavedChanges: () => boolean;
  handleTagClick: (tagId: NodeId) => boolean;
  clearValidationErrors: () => void;
  clearAllRules: () => void;
  cleanupInvalidRules: (index: TaxonomyIndex | null) => void;
  
  // Import support
  /** Set saved rules from imported project pack. Closes panel, resets all edit state. */
  setSavedRules: (rules: Rule[], index: TaxonomyIndex | null) => void;
}

/** Generate a unique ID */
function generateId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Deep clone rules array */
function cloneRules(rules: Rule[]): Rule[] {
  return rules.map(r => ({
    ...r,
    targetTagIds: [...r.targetTagIds],
  }));
}

/** Check if two rule arrays are equal */
function rulesEqual(a: Rule[], b: Rule[]): boolean {
  if (a.length !== b.length) return false;
  
  for (let i = 0; i < a.length; i++) {
    const ra = a[i];
    const rb = b[i];
    if (
      ra.id !== rb.id ||
      ra.name !== rb.name ||
      ra.triggerTagId !== rb.triggerTagId ||
      ra.type !== rb.type ||
      ra.targetTagIds.length !== rb.targetTagIds.length ||
      !ra.targetTagIds.every((t, j) => t === rb.targetTagIds[j])
    ) {
      return false;
    }
  }
  
  return true;
}

export const useRulesStore = create<RulesState & RulesActions>()(
  persist(
    (set, get) => ({
      savedRules: [],
      draftRules: [],
      isPanelOpen: false,
      editingRuleId: null,
      editMode: 'idle',
      validationErrors: [],
      validationWarnings: [],

      openPanel: () => {
        const { savedRules } = get();
        set({
          isPanelOpen: true,
          draftRules: cloneRules(savedRules),
          validationErrors: [],
          validationWarnings: [],
        });
      },

      closePanel: (force = false) => {
        const { hasUnsavedChanges } = get();
        
        if (!force && hasUnsavedChanges()) {
          // Caller should handle confirmation dialog
          return false;
        }
        
        set({
          isPanelOpen: false,
          editingRuleId: null,
          editMode: 'idle',
          draftRules: [],
          validationErrors: [],
          validationWarnings: [],
        });
        return true;
      },

      startEditingTrigger: (ruleId) => {
        set({
          editingRuleId: ruleId,
          editMode: 'selecting-trigger',
        });
      },

      startEditingTargets: (ruleId) => {
        set({
          editingRuleId: ruleId,
          editMode: 'selecting-targets',
        });
      },

      stopEditing: () => {
        set({
          editingRuleId: null,
          editMode: 'idle',
        });
      },

      createRule: (partial) => {
        const id = generateId();
        const newRule: Rule = {
          id,
          name: partial?.name ?? 'New Rule',
          triggerTagId: partial?.triggerTagId ?? null,
          type: partial?.type ?? 'EXCLUDES',
          targetTagIds: partial?.targetTagIds ?? [],
        };
        set((state) => ({
          draftRules: [...state.draftRules, newRule],
        }));
        return id;
      },

      deleteRule: (id) => {
        set((state) => ({
          draftRules: state.draftRules.filter((r) => r.id !== id),
          editingRuleId: state.editingRuleId === id ? null : state.editingRuleId,
          editMode: state.editingRuleId === id ? 'idle' : state.editMode,
        }));
      },

      renameRule: (id, name) => {
        set((state) => ({
          draftRules: state.draftRules.map((r) =>
            r.id === id ? { ...r, name } : r
          ),
        }));
      },

      setRuleType: (id, type) => {
        set((state) => ({
          draftRules: state.draftRules.map((r) =>
            r.id === id ? { ...r, type } : r
          ),
        }));
      },

      setTriggerTag: (id, tagId) => {
        set((state) => ({
          draftRules: state.draftRules.map((r) =>
            r.id === id ? { ...r, triggerTagId: tagId } : r
          ),
        }));
      },

      addTargets: (id, tagIds) => {
        set((state) => ({
          draftRules: state.draftRules.map((r) => {
            if (r.id !== id) return r;
            const existingSet = new Set(r.targetTagIds);
            const newTargets = tagIds.filter((t) => !existingSet.has(t));
            return {
              ...r,
              targetTagIds: [...r.targetTagIds, ...newTargets],
            };
          }),
        }));
      },

      removeTarget: (id, tagId) => {
        set((state) => ({
          draftRules: state.draftRules.map((r) =>
            r.id === id
              ? { ...r, targetTagIds: r.targetTagIds.filter((t) => t !== tagId) }
              : r
          ),
        }));
      },

      clearTargets: (id) => {
        set((state) => ({
          draftRules: state.draftRules.map((r) =>
            r.id === id ? { ...r, targetTagIds: [] } : r
          ),
        }));
      },

      saveRules: (index) => {
        const { draftRules } = get();
        
        // Validate
        const { errors, warnings } = validateRules(draftRules, index);
        
        if (errors.length > 0) {
          set({ validationErrors: errors, validationWarnings: warnings });
          return false;
        }
        
        // Save: commit draftRules to savedRules
        set({
          savedRules: cloneRules(draftRules),
          validationErrors: [],
          validationWarnings: warnings, // Keep warnings even on successful save
        });
        
        return true;
      },

      discardChanges: () => {
        const { savedRules } = get();
        set({
          draftRules: cloneRules(savedRules),
          validationErrors: [],
          validationWarnings: [],
          editingRuleId: null,
          editMode: 'idle',
        });
      },

      hasUnsavedChanges: () => {
        const { savedRules, draftRules } = get();
        return !rulesEqual(savedRules, draftRules);
      },

      handleTagClick: (tagId) => {
        const { editMode, editingRuleId, setTriggerTag, addTargets } = get();

        if (editMode === 'idle' || !editingRuleId) {
          return false;
        }

        if (editMode === 'selecting-trigger') {
          setTriggerTag(editingRuleId, tagId);
          set({ editMode: 'idle', editingRuleId: null });
          return true;
        }

        if (editMode === 'selecting-targets') {
          addTargets(editingRuleId, [tagId]);
          return true;
        }

        return false;
      },

      clearValidationErrors: () => {
        set({ validationErrors: [], validationWarnings: [] });
      },

      clearAllRules: () => {
        set({
          draftRules: [],
          editingRuleId: null,
          editMode: 'idle',
        });
      },

      cleanupInvalidRules: (index) => {
        if (!index) return;

        const { savedRules } = get();
        if (savedRules.length === 0) return;

        // Only clean up savedRules, never touch draftRules
        // This ensures user's unsaved edits are not lost
        let hasChanges = false;
        const cleanedRules = savedRules.map((rule) => {
          let changed = false;
          let newTrigger = rule.triggerTagId;
          let newTargets = rule.targetTagIds;

          if (newTrigger !== null && !index.byId.has(newTrigger)) {
            console.warn(
              `[RulesStore] Rule "${rule.name}": trigger "${newTrigger}" not found in index, clearing.`
            );
            newTrigger = null;
            changed = true;
          }

          const validTargets = newTargets.filter((t) => index.byId.has(t));
          if (validTargets.length !== newTargets.length) {
            const removed = newTargets.filter((t) => !index.byId.has(t));
            console.warn(
              `[RulesStore] Rule "${rule.name}": removed ${removed.length} invalid targets: ${removed.join(', ')}`
            );
            newTargets = validTargets;
            changed = true;
          }

          if (changed) {
            hasChanges = true;
            return { ...rule, triggerTagId: newTrigger, targetTagIds: newTargets };
          }
          return rule;
        });

        if (hasChanges) {
          set({ savedRules: cleanedRules });
        }
        // Note: draftRules are not cleaned here - they will be validated on save
      },

      setSavedRules: (rules, index) => {
        // 1. Overwrite savedRules with deep clone
        // 2. Force close panel and reset all edit state
        set({
          savedRules: cloneRules(rules),
          isPanelOpen: false,
          draftRules: [],
          editingRuleId: null,
          editMode: 'idle',
          validationErrors: [],
          validationWarnings: [],
        });

        // 3. Cleanup invalid references (only call once, after set)
        if (index) {
          get().cleanupInvalidRules(index);
        }
      },
    }),
    {
      name: 'tagselector-rules',
      version: 2, // Bump version for migration
      // Only persist savedRules
      partialize: (state) => ({ savedRules: state.savedRules }),
      migrate: (persistedState: unknown, version: number) => {
        // Migration from version 0/1 (old format with `rules`) to version 2 (new format with `savedRules`)
        const state = persistedState as Record<string, unknown>;
        
        if (version < 2) {
          // Old format had `rules` instead of `savedRules`
          if (state.rules && Array.isArray(state.rules)) {
            console.log('[RulesStore] Migrating from old format (rules) to new format (savedRules)');
            return {
              savedRules: state.rules,
            };
          }
        }
        
        return state as { savedRules: Rule[] };
      },
      onRehydrateStorage: () => (state) => {
        // After rehydration, initialize draftRules if panel is somehow open
        if (state && state.isPanelOpen) {
          state.draftRules = cloneRules(state.savedRules);
        }
      },
    }
  )
);
