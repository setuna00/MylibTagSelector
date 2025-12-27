/**
 * CreateNodeButtons
 *
 * Three vertical buttons for creating nodes and toggling edit mode:
 * - New Folder
 * - New Tag
 * - Edit Mode Toggle
 */

import { Button, Paper, Stack } from '@mantine/core';
import { FolderPlus, Tags } from 'lucide-react';
import { useSettingsStore } from '../../store';
import { EditingModeToggle } from './EditingModeToggle';
import type { NodeId } from '@tagselector/tag-core';

interface CreateNodeButtonsProps {
  currentFolderId: NodeId | null;
  onCreateFolder: () => void;
  onCreateTag: () => void;
}

export function CreateNodeButtons({
  currentFolderId,
  onCreateFolder,
  onCreateTag,
}: CreateNodeButtonsProps) {
  const { uiLanguage } = useSettingsStore();

  return (
    <Paper p="md" withBorder>
      <Stack gap="xs">
        <Button
          size="xs"
          variant="subtle"
          leftSection={<FolderPlus size={14} />}
          onClick={onCreateFolder}
          style={{
            fontSize: '12px',
            padding: '4px 8px',
            minWidth: 'auto',
            border: '1px solid var(--mantine-color-gray-4)',
          }}
        >
          {uiLanguage === 'zh' ? '+ 新建文件夹' : '+ New Folder'}
        </Button>
        <Button
          size="xs"
          variant="subtle"
          leftSection={<Tags size={14} />}
          onClick={onCreateTag}
          style={{
            fontSize: '12px',
            padding: '4px 8px',
            minWidth: 'auto',
            border: '1px solid var(--mantine-color-gray-4)',
          }}
        >
          {uiLanguage === 'zh' ? '+ 新建 Tag' : '+ New Tag'}
        </Button>
        <EditingModeToggle />
      </Stack>
    </Paper>
  );
}

