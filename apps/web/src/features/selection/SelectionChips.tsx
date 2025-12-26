import { Button, Badge, ActionIcon, Group } from '@mantine/core';
import { X } from 'lucide-react';
import type { NodeId, TaxonomyIndex } from '@tagselector/tag-core';
import { getTagColorHex, getReadableTextColor } from '../../utils/tagColor';
import styles from './SelectionChips.module.css';

interface SelectionChipsProps {
  index: TaxonomyIndex;
  selectedIds: Set<NodeId>;
  onDeselect: (nodeId: NodeId) => void;
  onClear: () => void;
}

export function SelectionChips({
  index,
  selectedIds,
  onDeselect,
  onClear,
}: SelectionChipsProps) {
  const selectedNodes = Array.from(selectedIds)
    .map((id) => index.byId.get(id))
    .filter(Boolean);

  if (selectedNodes.length === 0) {
    return (
      <div className={styles.empty}>
        点击标签以选择
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>
          已选 ({selectedNodes.length})
        </span>
        <Button variant="subtle" size="sm" onClick={onClear}>
          清空
        </Button>
      </div>
      <div className={styles.chips}>
        {selectedNodes.map((node) => {
          const hex = getTagColorHex(node!);
          const textColor = hex ? getReadableTextColor(hex) : undefined;
          
          // Build style based on color
          const badgeStyle = hex
            ? {
                backgroundColor: hex,
                borderColor: hex,
                color: textColor,
                maxWidth: 195, // 150 * 1.3，匹配放大后的比例
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }
            : {
                maxWidth: 195, // 150 * 1.3
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              };

          // Build Badge props conditionally - don't pass color prop when using custom color
          const badgeProps = hex
            ? {
                // No color prop when using custom color to avoid Mantine override
                style: badgeStyle,
              }
            : {
                color: 'blue',
                style: badgeStyle,
              };

          return (
            <Group key={node!.id} gap={4} wrap="nowrap">
              <Badge
                size="lg"
                variant="filled"
                radius="xl"
                className="tag-badge"
                {...badgeProps}
              >
                {node!.label}
              </Badge>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="blue"
                onClick={() => onDeselect(node!.id)}
                aria-label={`Remove ${node!.label}`}
              >
                <X size={14} />
              </ActionIcon>
            </Group>
          );
        })}
      </div>
    </div>
  );
}
