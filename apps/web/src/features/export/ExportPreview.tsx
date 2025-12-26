import { useMemo } from 'react';
import { Button, Badge, SegmentedControl } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { NodeId, TaxonomyIndex, TagNode } from '@tagselector/tag-core';
import {
  computeExportSet,
  sortByUserOrder,
  DEFAULT_SEPARATOR,
} from '@tagselector/tag-core';
import { useClipboard } from '../../hooks/useClipboard';
import { useSettingsStore } from '../../store';
import styles from './ExportPreview.module.css';

interface ExportPreviewProps {
  index: TaxonomyIndex;
  selectedIds: Set<NodeId>;
}

/**
 * Get display label for a node based on export mode.
 * Uses safe type casting to access node.data.displayName.
 */
function getDisplayLabel(node: TagNode, mode: 'primary' | 'display'): string {
  if (mode === 'primary') {
    return node.label;
  }
  // display mode: use displayName if available, fallback to label
  const nodeWithData = node as TagNode & { data?: { displayName?: string } };
  return nodeWithData.data?.displayName ?? node.label;
}

export function ExportPreview({ index, selectedIds }: ExportPreviewProps) {
  const { copy, isCopied } = useClipboard();
  const { exportLabelMode, setExportLabelMode, uiLanguage } = useSettingsStore();

  const { outputText, closureNodes } = useMemo(() => {
    if (selectedIds.size === 0) {
      return {
        outputText: '',
        closureNodes: [],
      };
    }

    const exportSet = computeExportSet(index, selectedIds);
    const sortedIds = sortByUserOrder(index, exportSet);

    // Format output based on exportLabelMode
    const labels: string[] = [];
    for (const nodeId of sortedIds) {
      const node = index.byId.get(nodeId);
      if (node) {
        labels.push(getDisplayLabel(node, exportLabelMode));
      }
    }
    const outputText = labels.join(DEFAULT_SEPARATOR);

    // Get closure nodes with info about whether they're auto-included
    const closureNodes = sortedIds.map((id) => {
      const node = index.byId.get(id)!;
      const isAutoIncluded = !selectedIds.has(id);
      return { node, isAutoIncluded };
    });

    return { outputText, closureNodes };
  }, [index, selectedIds, exportLabelMode]);

  // Internationalization strings
  const i18n = {
    empty: uiLanguage === 'zh' ? '(空)' : '(empty)',
    output: uiLanguage === 'zh' ? '输出' : 'Output',
    copy: uiLanguage === 'zh' ? '复制' : 'Copy',
    copied: uiLanguage === 'zh' ? '已复制' : 'Copied',
    copyFailed: uiLanguage === 'zh' ? '复制失败' : 'Copy failed',
    selectTags: uiLanguage === 'zh' ? '选择标签以查看导出预览' : 'Select tags to view export preview',
    tags: uiLanguage === 'zh' ? '个标签' : ' tags',
    primary: uiLanguage === 'zh' ? '主名' : 'Primary',
    display: uiLanguage === 'zh' ? '显示名' : 'Display',
  };

  if (selectedIds.size === 0) {
    return (
      <div className={styles.empty}>
        {i18n.selectTags}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Compact chips row */}
      <div className={styles.section}>
        <div className={styles.chips}>
          {closureNodes.map(({ node, isAutoIncluded }) => (
            <Badge
              key={node.id}
              size="lg"
              variant={isAutoIncluded ? 'light' : 'filled'}
              color={isAutoIncluded ? 'gray' : 'blue'}
              className="tag-badge"
              style={{
                fontStyle: isAutoIncluded ? 'italic' : 'normal',
              }}
            >
              {getDisplayLabel(node, 'display')}
              {isAutoIncluded && ' ↑'}
            </Badge>
          ))}
        </div>
      </div>

      {/* Output text section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            {i18n.output} ({closureNodes.length}{i18n.tags})
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await copy(outputText);
              if (res.ok) {
                notifications.show({ message: i18n.copied, color: 'green', autoClose: 2000 });
              } else {
                notifications.show({ message: `${i18n.copyFailed}: ${res.error ?? 'Unknown error'}`, color: 'red', autoClose: 4000 });
              }
            }}
            disabled={!outputText}
            className={styles.copyButton}
          >
            {isCopied ? i18n.copied : i18n.copy}
          </Button>
        </div>
        {/* Label mode selector */}
        <div style={{ marginBottom: '8px' }}>
          <SegmentedControl
            value={exportLabelMode}
            onChange={(value) => setExportLabelMode(value as 'primary' | 'display')}
            data={[
              { label: i18n.primary, value: 'primary' },
              { label: i18n.display, value: 'display' },
            ]}
            size="xs"
          />
        </div>
        <div className={styles.outputBox}>
          <code>{outputText || i18n.empty}</code>
        </div>
      </div>
    </div>
  );
}
