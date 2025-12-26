import { useMemo } from 'react';
import { Button, Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { NodeId, TaxonomyIndex } from '@tagselector/tag-core';
import {
  computeExportSet,
  sortByUserOrder,
  formatForMylio,
} from '@tagselector/tag-core';
import { useClipboard } from '../../hooks/useClipboard';
import styles from './ExportPreview.module.css';

interface ExportPreviewProps {
  index: TaxonomyIndex;
  selectedIds: Set<NodeId>;
}

export function ExportPreview({ index, selectedIds }: ExportPreviewProps) {
  const { copy, isCopied } = useClipboard();

  const { outputText, closureNodes } = useMemo(() => {
    if (selectedIds.size === 0) {
      return {
        outputText: '',
        closureNodes: [],
      };
    }

    const exportSet = computeExportSet(index, selectedIds);
    const sortedIds = sortByUserOrder(index, exportSet);
    const outputText = formatForMylio(index, sortedIds);

    // Get closure nodes with info about whether they're auto-included
    const closureNodes = sortedIds.map((id) => {
      const node = index.byId.get(id)!;
      const isAutoIncluded = !selectedIds.has(id);
      return { node, isAutoIncluded };
    });

    return { outputText, closureNodes };
  }, [index, selectedIds]);

  if (selectedIds.size === 0) {
    return (
      <div className={styles.empty}>
        选择标签以查看导出预览
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
              {node.label}
              {isAutoIncluded && ' ↑'}
            </Badge>
          ))}
        </div>
      </div>

      {/* Output text section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            输出 ({closureNodes.length} 个标签)
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await copy(outputText);
              if (res.ok) {
                notifications.show({ message: '已复制到剪贴板', color: 'green', autoClose: 2000 });
              } else {
                notifications.show({ message: `复制失败: ${res.error ?? 'Unknown error'}`, color: 'red', autoClose: 4000 });
              }
            }}
            disabled={!outputText}
            className={styles.copyButton}
          >
            {isCopied ? '已复制' : '复制'}
          </Button>
        </div>
        <div className={styles.outputBox}>
          <code>{outputText || '(empty)'}</code>
        </div>
      </div>
    </div>
  );
}
