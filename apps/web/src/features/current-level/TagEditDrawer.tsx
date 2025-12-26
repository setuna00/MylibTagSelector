/**
 * TagEditDrawer
 *
 * Drawer for editing tag details (label, displayName, color, aliases).
 * Opens when clicking a tag in editing mode.
 */

import { useState, useEffect } from 'react';
import { Drawer, Button, Group, TextInput, Stack, Text, ColorInput, Badge, UnstyledButton } from '@mantine/core';
import type { NodeId, TaxonomyIndex, TagNode } from '@tagselector/tag-core';
import { useTaxonomyStore, useSettingsStore } from '../../store';
import { getTagColorHex } from '../../utils/tagColor';

interface TagEditDrawerProps {
  opened: boolean;
  onClose: () => void;
  tagId: NodeId | null;
  index: TaxonomyIndex;
}

// Common preset colors
const PRESET_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // yellow
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
];

export function TagEditDrawer({
  opened,
  onClose,
  tagId,
  index,
}: TagEditDrawerProps) {
  const { updateTagData } = useTaxonomyStore();
  const { uiLanguage } = useSettingsStore();
  const [label, setLabel] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState('');
  const [aliasesText, setAliasesText] = useState('');

  // Get current tag data when drawer opens or tagId changes
  useEffect(() => {
    if (opened && tagId) {
      const node = index.byId.get(tagId);
      if (node && node.kind === 'tag') {
        setLabel(node.label);
        
        // Get data fields
        const nodeWithData = node as TagNode & {
          data?: { displayName?: string; aliases?: string[]; color?: string };
        };
        setDisplayName(nodeWithData.data?.displayName || '');
        setColor(nodeWithData.data?.color || '');
        setAliasesText((nodeWithData.data?.aliases || []).join(', '));
      }
    }
  }, [opened, tagId, index]);

  const handleSave = () => {
    if (!tagId || !label.trim()) return;

    // Clean aliases: split by comma, trim, remove empty, dedupe (case-insensitive)
    const aliasesArray = aliasesText
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    
    // Dedupe case-insensitively
    const seen = new Set<string>();
    const dedupedAliases: string[] = [];
    for (const alias of aliasesArray) {
      const lower = alias.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        dedupedAliases.push(alias);
      }
    }

    updateTagData(tagId, {
      label: label.trim(),
      displayName: displayName.trim(),
      color: color.trim(),
      aliases: dedupedAliases,
    });

    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handlePresetColorClick = (presetColor: string) => {
    setColor(presetColor);
  };

  const i18n = {
    title: uiLanguage === 'zh' ? '编辑标签' : 'Edit Tag',
    primaryName: uiLanguage === 'zh' ? '主名称 (EN)' : 'Primary Name (EN)',
    primaryNamePlaceholder: uiLanguage === 'zh' ? '例如: 1girl, silver_hair' : 'e.g., 1girl, silver_hair',
    displayName: uiLanguage === 'zh' ? '显示名称 (可选)' : 'Display Name (optional)',
    displayNamePlaceholder: uiLanguage === 'zh' ? '例如: 1个女孩' : 'e.g., 1 Girl',
    color: uiLanguage === 'zh' ? '颜色' : 'Color',
    colorPlaceholder: uiLanguage === 'zh' ? '#RRGGBB' : '#RRGGBB',
    aliases: uiLanguage === 'zh' ? '别名' : 'Aliases',
    aliasesPlaceholder: uiLanguage === 'zh' ? '用逗号分隔，例如: aaa, bbb, ccc' : 'Comma-separated, e.g., aaa, bbb, ccc',
    aliasesHint: uiLanguage === 'zh' ? '用于搜索匹配，不导出' : 'For search matching, not exported',
    cancel: uiLanguage === 'zh' ? '取消' : 'Cancel',
    save: uiLanguage === 'zh' ? '保存' : 'Save',
  };

  if (!tagId) {
    return null;
  }

  const node = index.byId.get(tagId);
  if (!node || node.kind !== 'tag') {
    return null;
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleCancel}
      title={i18n.title}
      position="right"
      size="md"
      padding="md"
    >
      <Stack gap="md">
        {/* Primary Name */}
        <TextInput
          label={i18n.primaryName}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={i18n.primaryNamePlaceholder}
          required
          autoFocus
        />

        {/* Display Name */}
        <TextInput
          label={i18n.displayName}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={i18n.displayNamePlaceholder}
        />

        {/* Color */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            {i18n.color}
          </Text>
          <Stack gap="xs">
            <ColorInput
              value={color}
              onChange={setColor}
              placeholder={i18n.colorPlaceholder}
              format="hex"
            />
            {/* Preset colors - circular color swatches */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {PRESET_COLORS.map((presetColor) => (
                <UnstyledButton
                  key={presetColor}
                  onClick={() => handlePresetColorClick(presetColor)}
                  style={{ cursor: 'pointer', padding: 0 }}
                  title={presetColor}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: presetColor,
                      border: color === presetColor ? '3px solid #000' : '2px solid #ccc',
                      boxShadow: color === presetColor ? '0 0 0 2px rgba(0, 0, 0, 0.1)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  />
                </UnstyledButton>
              ))}
            </div>
          </Stack>
        </div>

        {/* Aliases */}
        <div>
          <TextInput
            label={i18n.aliases}
            value={aliasesText}
            onChange={(e) => setAliasesText(e.target.value)}
            placeholder={i18n.aliasesPlaceholder}
          />
          <Text size="xs" c="dimmed" mt="xs">
            {i18n.aliasesHint}
          </Text>
        </div>

        {/* Action buttons */}
        <Group justify="flex-end" gap="sm" mt="md">
          <Button variant="subtle" onClick={handleCancel}>
            {i18n.cancel}
          </Button>
          <Button onClick={handleSave} disabled={!label.trim()}>
            {i18n.save}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

