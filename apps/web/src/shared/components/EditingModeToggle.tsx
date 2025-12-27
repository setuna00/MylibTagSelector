/**
 * EditingModeToggle
 *
 * Button component for toggling global editing mode.
 * Displays current editing state and allows switching on click.
 */

import { Button } from '@mantine/core';
import { useSettingsStore } from '../../store';

export function EditingModeToggle() {
  const { uiLanguage, isEditing, toggleEditing } = useSettingsStore();

  return (
    <Button
      size="xs"
      variant={isEditing ? 'filled' : 'subtle'}
      color={isEditing ? 'blue' : undefined}
      onClick={toggleEditing}
      style={{
        fontSize: '12px',
        padding: '4px 8px',
        minWidth: 'auto',
        border: isEditing ? undefined : '1px solid var(--mantine-color-gray-4)',
      }}
    >
      {isEditing
        ? uiLanguage === 'zh'
          ? '退出编辑'
          : 'Exit Edit'
        : uiLanguage === 'zh'
          ? '编辑模式'
          : 'Edit Mode'}
    </Button>
  );
}

