/**
 * LanguageToggle
 *
 * Small button component for toggling UI language between zh/en.
 * Displays current language and allows switching on click.
 */

import { Button } from '@mantine/core';
import { useSettingsStore } from '../../store';

export function LanguageToggle() {
  const { uiLanguage, toggleLanguage } = useSettingsStore();

  return (
    <Button
      size="xs"
      variant="subtle"
      onClick={toggleLanguage}
      style={{
        fontSize: '12px',
        padding: '4px 8px',
        minWidth: 'auto',
      }}
    >
      {uiLanguage === 'zh' ? '中文' : 'EN'}
    </Button>
  );
}

