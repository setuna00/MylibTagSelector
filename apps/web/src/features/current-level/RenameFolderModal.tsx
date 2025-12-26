/**
 * RenameFolderModal
 *
 * Modal for renaming a folder (or Root).
 * Updates the folder's label in taxonomy.
 */

import { useState, useEffect } from 'react';
import { Modal, Button, Group, TextInput, Stack } from '@mantine/core';
import type { NodeId, TaxonomyIndex } from '@tagselector/tag-core';
import { useTaxonomyStore, useSettingsStore } from '../../store';

interface RenameFolderModalProps {
  opened: boolean;
  onClose: () => void;
  nodeId: NodeId | null;
  index: TaxonomyIndex;
}

export function RenameFolderModal({
  opened,
  onClose,
  nodeId,
  index,
}: RenameFolderModalProps) {
  const { updateNodeLabel, taxonomy } = useTaxonomyStore();
  const { uiLanguage } = useSettingsStore();
  const [label, setLabel] = useState('');

  // Get current label when modal opens or nodeId changes
  useEffect(() => {
    if (opened) {
      if (nodeId === null) {
        // Root: use taxonomy.meta.name
        const currentName = taxonomy?.meta?.name || 'Root';
        setLabel(currentName);
      } else {
        // Regular folder: use node.label
        const node = index.byId.get(nodeId);
        setLabel(node?.label || '');
      }
    }
  }, [opened, nodeId, index, taxonomy]);

  const handleSave = () => {
    if (label.trim()) {
      updateNodeLabel(nodeId, label.trim());
      onClose();
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title={uiLanguage === 'zh' ? '重命名文件夹' : 'Rename Folder'}
      size="md"
    >
      <Stack gap="md">
        <TextInput
          label={uiLanguage === 'zh' ? '文件夹名称' : 'Folder Name'}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={uiLanguage === 'zh' ? '输入文件夹名称' : 'Enter folder name'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave();
            }
          }}
          autoFocus
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={handleCancel}>
            {uiLanguage === 'zh' ? '取消' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={!label.trim()}>
            {uiLanguage === 'zh' ? '保存' : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

