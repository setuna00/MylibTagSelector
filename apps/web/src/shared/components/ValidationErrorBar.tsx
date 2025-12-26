/**
 * ValidationErrorBar
 *
 * A lightweight, non-intrusive error notification bar.
 * - Shows at the top of the right panel
 * - Collapsible with summary view
 * - Shows first N errors with "show all" option
 * - Does not block user interaction (non-modal)
 */

import { useState } from 'react';
import { Paper, Text, Group, ActionIcon, Collapse, Badge, Stack, Button } from '@mantine/core';
import { AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { ValidationError } from '@tagselector/tag-core';

interface ValidationErrorBarProps {
  errors: ValidationError[];
  onDismiss?: () => void;
  maxPreview?: number;
}

export function ValidationErrorBar({
  errors,
  onDismiss,
  maxPreview = 3,
}: ValidationErrorBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (errors.length === 0 || isDismissed) {
    return null;
  }

  const previewErrors = errors.slice(0, maxPreview);
  const hasMore = errors.length > maxPreview;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <Paper
      p="xs"
      withBorder
      style={{
        backgroundColor: 'var(--mantine-color-yellow-0)',
        borderColor: 'var(--mantine-color-yellow-4)',
      }}
    >
      {/* Header: Icon + Summary + Controls */}
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <AlertTriangle
            size={16}
            style={{ color: 'var(--mantine-color-yellow-7)', flexShrink: 0 }}
          />
          <Text size="xs" fw={500} c="yellow.8" truncate>
            数据校验问题 ({errors.length} 项)
          </Text>
          <Badge size="xs" color="yellow" variant="light">
            {errors[0]?.code}
          </Badge>
        </Group>

        <Group gap={4} wrap="nowrap">
          <ActionIcon
            size="xs"
            variant="subtle"
            color="yellow.7"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? '收起' : '展开'}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </ActionIcon>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="gray"
            onClick={handleDismiss}
            aria-label="关闭"
          >
            <X size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Expanded Content: Error List */}
      <Collapse in={isExpanded}>
        <Stack gap="xs" mt="xs">
          {(isExpanded ? errors : previewErrors).map((error, idx) => (
            <Paper
              key={`${error.code}-${idx}`}
              p="xs"
              style={{
                backgroundColor: 'var(--mantine-color-white)',
                border: '1px solid var(--mantine-color-gray-2)',
              }}
            >
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <Badge size="xs" color="red" variant="light" style={{ flexShrink: 0 }}>
                  {error.code}
                </Badge>
                <Text size="xs" c="dimmed" style={{ wordBreak: 'break-word' }}>
                  <Text span fw={500} c="dark">
                    {error.path}
                  </Text>
                  {error.path && ': '}
                  {error.message}
                </Text>
              </Group>
            </Paper>
          ))}

          {!isExpanded && hasMore && (
            <Button
              size="xs"
              variant="subtle"
              color="yellow.7"
              onClick={() => setIsExpanded(true)}
            >
              查看全部 {errors.length} 项错误
            </Button>
          )}

          {isExpanded && (
            <Text size="xs" c="dimmed" fs="italic">
              提示：导航护栏已启用，无效数据不会影响正常使用。建议重新导入有效的分类法数据。
            </Text>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}

