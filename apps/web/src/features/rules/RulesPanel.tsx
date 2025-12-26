/**
 * RulesPanel
 *
 * Side panel for editing rules with Draft + Save model.
 *
 * UI Components:
 * - Status bar: Shows Saved/Unsaved state + Save/Cancel buttons
 * - Error display: Shows validation errors after failed save
 * - Rule list: Accordion-style rule editor
 *
 * Interaction Flow:
 * 1. Open panel → draft = copy of saved rules
 * 2. Edit draft (create/modify/delete rules)
 * 3. Click Save → validate → if pass, commit to saved; if fail, show errors
 * 4. Click Cancel → discard changes, restore draft to saved
 * 5. Close panel → if unsaved changes, show confirmation dialog
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  Trash2,
  X,
  Target,
  Crosshair,
  XCircle,
} from 'lucide-react';
import type { NodeId, TaxonomyIndex } from '@tagselector/tag-core';
import {
  useRulesStore,
  type Rule,
  type RuleEditMode,
  type RuleValidationError,
  type RuleValidationWarning,
} from '../../store/rulesStore';
import styles from './RulesPanel.module.css';

interface RulesPanelProps {
  index: TaxonomyIndex;
}

/**
 * Get tag label from index, or "(missing)" if not found.
 */
function getTagLabel(index: TaxonomyIndex, tagId: NodeId): string {
  const node = index.byId.get(tagId);
  if (!node) {
    return '(missing)';
  }
  return node.label;
}

/**
 * Generate rule summary for collapsed view.
 */
function getRuleSummary(rule: Rule, index: TaxonomyIndex): string {
  const triggerLabel = rule.triggerTagId
    ? getTagLabel(index, rule.triggerTagId)
    : '?';
  const targetCount = rule.targetTagIds.length;
  const typeSymbol = rule.type === 'EXCLUDES' ? '⊘' : '→';

  return `${triggerLabel} ${typeSymbol} (${targetCount})`;
}

// ============================================================================
// ValidationErrorsDisplay Component
// ============================================================================

interface ValidationErrorsDisplayProps {
  errors: RuleValidationError[];
  onDismiss: () => void;
}

function ValidationErrorsDisplay({ errors, onDismiss }: ValidationErrorsDisplayProps) {
  if (errors.length === 0) return null;

  return (
    <Alert
      color="red"
      icon={<AlertTriangle size={16} />}
      title={`保存失败 (${errors.length} 个错误)`}
      withCloseButton
      onClose={onDismiss}
      className={styles.errorAlert}
    >
      <Stack gap="xs">
        {errors.map((error, idx) => (
          <div key={idx} className={styles.errorItem}>
            <Text size="xs" fw={500}>
              {error.ruleName}
              {error.triggerLabel && ` · ${error.triggerLabel}`}
            </Text>
            <Text size="xs" c="red.7">
              {error.message}
            </Text>
          </div>
        ))}
      </Stack>
    </Alert>
  );
}

interface ValidationWarningsDisplayProps {
  warnings: RuleValidationWarning[];
  onDismiss: () => void;
}

function ValidationWarningsDisplay({ warnings, onDismiss }: ValidationWarningsDisplayProps) {
  if (warnings.length === 0) return null;

  return (
    <Alert
      color="yellow"
      icon={<AlertTriangle size={16} />}
      title={`警告 (${warnings.length} 个)`}
      withCloseButton
      onClose={onDismiss}
      className={styles.errorAlert}
    >
      <Stack gap="xs">
        {warnings.map((warning, idx) => (
          <div key={idx} className={styles.errorItem}>
            <Text size="xs" fw={500}>
              {warning.triggerLabels.join(' + ')}
            </Text>
            <Text size="xs" c="yellow.7">
              {warning.message}
            </Text>
          </div>
        ))}
      </Stack>
    </Alert>
  );
}

// ============================================================================
// RuleItem Component
// ============================================================================

interface RuleItemProps {
  rule: Rule;
  index: TaxonomyIndex;
  isEditing: boolean;
  editMode: RuleEditMode;
  hasError: boolean;
}

function RuleItem({ rule, index, isEditing, editMode, hasError }: RuleItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(rule.name);

  const {
    renameRule,
    setRuleType,
    removeTarget,
    clearTargets,
    deleteRule,
    startEditingTrigger,
    startEditingTargets,
    stopEditing,
    setTriggerTag,
  } = useRulesStore();

  // Auto-expand when this rule is being edited or has error
  useEffect(() => {
    if (isEditing || hasError) {
      setExpanded(true);
    }
  }, [isEditing, hasError]);

  // Update local name when rule changes
  useEffect(() => {
    setNameValue(rule.name);
  }, [rule.name]);

  const handleNameBlur = () => {
    setEditingName(false);
    if (nameValue.trim() && nameValue !== rule.name) {
      renameRule(rule.id, nameValue.trim());
    } else {
      setNameValue(rule.name);
    }
  };

  const handleTriggerClick = () => {
    if (isEditing && editMode === 'selecting-trigger') {
      stopEditing();
    } else {
      startEditingTrigger(rule.id);
    }
  };

  const handleTargetsClick = () => {
    if (isEditing && editMode === 'selecting-targets') {
      stopEditing();
    } else {
      startEditingTargets(rule.id);
    }
  };

  const handleClearTrigger = () => {
    setTriggerTag(rule.id, null);
  };

  const isTriggerMode = isEditing && editMode === 'selecting-trigger';
  const isTargetsMode = isEditing && editMode === 'selecting-targets';

  return (
    <Paper
      p="sm"
      withBorder
      className={`${styles.ruleItem} ${hasError ? styles.ruleItemError : ''}`}
    >
      {/* Header Row: collapse toggle + name + summary + delete */}
      <Group gap="xs" wrap="nowrap" className={styles.ruleHeader}>
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </ActionIcon>

        {editingName ? (
          <TextInput
            size="xs"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameBlur();
              if (e.key === 'Escape') {
                setNameValue(rule.name);
                setEditingName(false);
              }
            }}
            autoFocus
            className={styles.nameInput}
          />
        ) : (
          <Text
            size="sm"
            fw={500}
            className={styles.ruleName}
            onClick={() => setEditingName(true)}
            title="点击编辑名称"
          >
            {rule.name}
          </Text>
        )}

        <Text size="xs" c="dimmed" className={styles.summary}>
          {getRuleSummary(rule, index)}
        </Text>

        {hasError && (
          <AlertTriangle size={14} color="var(--mantine-color-red-6)" />
        )}

        <ActionIcon
          variant="subtle"
          size="sm"
          color="red"
          onClick={() => deleteRule(rule.id)}
          aria-label="Delete rule"
        >
          <Trash2 size={14} />
        </ActionIcon>
      </Group>

      {/* Expanded Content */}
      {expanded && (
        <Stack gap="sm" mt="sm" className={styles.ruleContent}>
          {/* Trigger Tag Section */}
          <div className={styles.triggerSection}>
            <Group gap="xs" justify="space-between" mb={6}>
              <Text size="xs" fw={500}>
                触发标签 (A)
              </Text>
              <Button
                size="compact-xs"
                variant={isTriggerMode ? 'filled' : 'light'}
                color={isTriggerMode ? 'blue' : 'gray'}
                leftSection={<Crosshair size={12} />}
                onClick={handleTriggerClick}
              >
                {isTriggerMode ? '选择中...' : '选择'}
              </Button>
            </Group>
            {rule.triggerTagId ? (
              <Badge
                size="lg"
                variant="light"
                color="blue"
                className="tag-badge"
                rightSection={
                  <ActionIcon
                    variant="transparent"
                    size="xs"
                    onClick={handleClearTrigger}
                  >
                    <X size={12} />
                  </ActionIcon>
                }
              >
                {getTagLabel(index, rule.triggerTagId)}
              </Badge>
            ) : (
              <Text size="sm" fs="italic" c="dimmed">
                {isTriggerMode ? '👆 点击左侧 tag 设置' : '未设置'}
              </Text>
            )}
          </div>

          {/* Rule Type Switch */}
          <div className={styles.typeSection}>
            <Group gap="md" align="center">
              <Text size="xs" c={rule.type === 'EXCLUDES' ? 'red' : 'dimmed'}>
                互斥 ⊘
              </Text>
              <Switch
                size="md"
                checked={rule.type === 'REQUIRES'}
                onChange={(e) =>
                  setRuleType(rule.id, e.currentTarget.checked ? 'REQUIRES' : 'EXCLUDES')
                }
                color="green"
              />
              <Text size="xs" c={rule.type === 'REQUIRES' ? 'green' : 'dimmed'}>
                依赖 →
              </Text>
            </Group>
          </div>

          {/* Target Tags Section */}
          <div className={styles.targetsSection}>
            <Group gap="xs" justify="space-between" mb={6}>
              <Group gap="xs">
                <Text size="xs" fw={500}>
                  目标标签 ({rule.targetTagIds.length})
                </Text>
                {rule.targetTagIds.length > 0 && (
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    color="red"
                    onClick={() => clearTargets(rule.id)}
                    aria-label="Clear all targets"
                  >
                    <Trash2 size={10} />
                  </ActionIcon>
                )}
              </Group>
              <Button
                size="compact-xs"
                variant={isTargetsMode ? 'filled' : 'light'}
                color={isTargetsMode ? 'green' : 'gray'}
                leftSection={<Target size={12} />}
                onClick={handleTargetsClick}
              >
                {isTargetsMode ? '添加中...' : '添加'}
              </Button>
            </Group>
            <div className={styles.targetsContainer}>
              {rule.targetTagIds.length > 0 ? (
                rule.targetTagIds.map((tagId) => (
                  <Badge
                    key={tagId}
                    size="lg"
                    variant="outline"
                    className="tag-badge"
                    rightSection={
                      <ActionIcon
                        variant="transparent"
                        size="xs"
                        onClick={() => removeTarget(rule.id, tagId)}
                      >
                        <X size={12} />
                      </ActionIcon>
                    }
                  >
                    {getTagLabel(index, tagId)}
                  </Badge>
                ))
              ) : (
                <Text size="sm" fs="italic" c="dimmed">
                  {isTargetsMode ? '👆 点击左侧 tags 添加' : '无目标'}
                </Text>
              )}
            </div>
          </div>
        </Stack>
      )}
    </Paper>
  );
}

// ============================================================================
// RulesPanel Main Component
// ============================================================================

export function RulesPanel({ index }: RulesPanelProps) {
  const {
    draftRules,
    isPanelOpen,
    editingRuleId,
    editMode,
    validationErrors,
    validationWarnings,
    closePanel,
    createRule,
    clearAllRules,
    stopEditing,
    saveRules,
    discardChanges,
    hasUnsavedChanges,
    clearValidationErrors,
  } = useRulesStore();

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const unsavedChanges = hasUnsavedChanges();

  // Get rule IDs with errors for highlighting
  const errorRuleIds = new Set(
    validationErrors
      .filter((e) => e.ruleId)
      .map((e) => e.ruleId)
  );

  const handleCreateRule = useCallback(() => {
    const id = createRule();
    useRulesStore.getState().startEditingTrigger(id);
  }, [createRule]);

  const handleClearAll = () => {
    if (draftRules.length === 0) return;
    if (window.confirm(`确定要删除所有 ${draftRules.length} 条规则吗？`)) {
      clearAllRules();
    }
  };

  const handleSave = () => {
    const success = saveRules(index);
    if (success) {
      // Optionally auto-close on successful save
      // closePanel(true);
    }
  };

  const handleDiscard = () => {
    discardChanges();
  };

  const handleClose = () => {
    if (unsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      closePanel(true);
    }
  };

  const handleConfirmClose = (discard: boolean) => {
    setShowCloseConfirm(false);
    if (discard) {
      discardChanges();
      closePanel(true);
    }
  };

  // Click anywhere in panel (not on a button) to stop editing mode
  const handlePanelClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        stopEditing();
      }
    },
    [stopEditing]
  );

  if (!isPanelOpen) {
    return null;
  }

  return (
    <div className={styles.panelContainer} onClick={handlePanelClick}>
      {/* Panel Header with Status */}
      <div className={styles.panelHeader}>
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <Text size="md" fw={600}>
              📋 规则
            </Text>
            {unsavedChanges ? (
              <Badge size="sm" color="orange" variant="light">
                未保存
              </Badge>
            ) : (
              <Badge size="sm" color="green" variant="light">
                已保存
              </Badge>
            )}
          </Group>
          <ActionIcon variant="subtle" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </ActionIcon>
        </Group>

        {/* Save/Discard Buttons */}
        <Group gap="xs" mb="sm">
          <Button
            size="xs"
            leftSection={<Save size={14} />}
            onClick={handleSave}
            disabled={!unsavedChanges}
          >
            保存
          </Button>
          <Button
            size="xs"
            variant="light"
            color="gray"
            leftSection={<XCircle size={14} />}
            onClick={handleDiscard}
            disabled={!unsavedChanges}
          >
            放弃更改
          </Button>
        </Group>
      </div>

      {/* Validation Errors Display */}
      <ValidationErrorsDisplay
        errors={validationErrors}
        onDismiss={clearValidationErrors}
      />

      {/* Validation Warnings Display */}
      <ValidationWarningsDisplay
        warnings={validationWarnings}
        onDismiss={clearValidationErrors}
      />

      {/* Edit Mode Indicator */}
      {editMode !== 'idle' && (
        <Paper p="xs" mb="sm" className={styles.editModeIndicator}>
          <Text size="xs" c="blue" ta="center">
            {editMode === 'selecting-trigger'
              ? '👈 点击左侧标签设为触发器'
              : '👈 点击左侧标签添加到目标'}
          </Text>
        </Paper>
      )}

      {/* Rules List */}
      <div className={styles.rulesList}>
        {draftRules.length === 0 ? (
          <Text size="sm" c="dimmed" fs="italic" ta="center" py="lg">
            暂无规则
          </Text>
        ) : (
          <Stack gap="xs">
            {draftRules.map((rule) => (
              <RuleItem
                key={rule.id}
                rule={rule}
                index={index}
                isEditing={editingRuleId === rule.id}
                editMode={editMode}
                hasError={errorRuleIds.has(rule.id)}
              />
            ))}
          </Stack>
        )}
      </div>

      {/* Panel Footer */}
      <Group gap="sm" mt="sm" className={styles.panelFooter}>
        <Button
          size="xs"
          leftSection={<Plus size={14} />}
          onClick={handleCreateRule}
          fullWidth
        >
          新建规则
        </Button>
        {draftRules.length > 0 && (
          <Button
            size="xs"
            variant="light"
            color="red"
            onClick={handleClearAll}
            fullWidth
          >
            清空全部
          </Button>
        )}
      </Group>

      {/* Close Confirmation Dialog */}
      {showCloseConfirm && (
        <div className={styles.confirmOverlay}>
          <Paper p="md" shadow="lg" className={styles.confirmDialog}>
            <Text size="sm" mb="md">
              有未保存的更改，确定要放弃吗？
            </Text>
            <Group gap="sm" justify="flex-end">
              <Button
                size="xs"
                variant="light"
                onClick={() => handleConfirmClose(false)}
              >
                继续编辑
              </Button>
              <Button
                size="xs"
                color="red"
                onClick={() => handleConfirmClose(true)}
              >
                放弃更改
              </Button>
            </Group>
          </Paper>
        </div>
      )}
    </div>
  );
}

/**
 * Rules toggle button to be placed in picker header.
 */
export function RulesToggleButton() {
  const { isPanelOpen, openPanel, closePanel, hasUnsavedChanges, savedRules } = useRulesStore();

  const handleClick = () => {
    if (!isPanelOpen) {
      openPanel();
    } else {
      // If panel is open, allow closing via button click
      if (hasUnsavedChanges()) {
        // Show confirmation dialog if there are unsaved changes
        if (window.confirm('有未保存的更改，确定要放弃吗？')) {
          closePanel(true);
        }
      } else {
        closePanel(true);
      }
    }
  };

  return (
    <Button
      size="compact-xs"
      variant={isPanelOpen ? 'filled' : 'light'}
      onClick={handleClick}
      rightSection={
        savedRules.length > 0 ? (
          <Badge size="xs" circle color="blue">
            {savedRules.length}
          </Badge>
        ) : null
      }
    >
      📋 规则
    </Button>
  );
}
