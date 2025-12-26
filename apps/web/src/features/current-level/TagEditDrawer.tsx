/**
 * TagEditDrawer
 *
 * Drawer for editing tag details (label, displayName, color, aliases).
 * Opens when clicking a tag in editing mode.
 */

import { useState, useEffect, useMemo } from 'react';
import { Drawer, Button, Group, TextInput, Stack, Text, ColorInput, Badge, UnstyledButton, Autocomplete, ActionIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { X } from 'lucide-react';
import type { NodeId, TaxonomyIndex, TagNode } from '@tagselector/tag-core';
import { getRecommendedTagIds } from '@tagselector/tag-core';
import { useTaxonomyStore, useSettingsStore } from '../../store';
import { getTagColorHex } from '../../utils/tagColor';
import { getTagDisplayLabel, nodeMatchesQuery } from '../../utils/searchMatch';

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
  const [recommendedTagIds, setRecommendedTagIds] = useState<string[]>([]);
  const [autocompleteValue, setAutocompleteValue] = useState('');
  
  // Constant empty array to ensure it's always iterable

  // Get current tag data when drawer opens or tagId changes
  useEffect(() => {
    if (opened && tagId) {
      const node = index.byId.get(tagId);
      if (node && node.kind === 'tag') {
        setLabel(node.label);
        
        // Get data fields
        const nodeWithData = node as TagNode & {
          data?: { displayName?: string; aliases?: string[]; color?: string; recommendedTagIds?: string[] };
        };
        setDisplayName(nodeWithData.data?.displayName || '');
        setColor(nodeWithData.data?.color || '');
        setAliasesText((nodeWithData.data?.aliases || []).join(', '));
        setRecommendedTagIds(getRecommendedTagIds(node));
        setAutocompleteValue('');
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
      recommendedTagIds: recommendedTagIds,
    });

    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handlePresetColorClick = (presetColor: string) => {
    setColor(presetColor);
  };

  // Get all tag nodes for autocomplete (exclude current tag and already recommended tags)
  const availableTags = useMemo(() => {
    const tags: TagNode[] = [];
    if (!index || !index.byId) {
      return tags;
    }
    for (const node of index.byId.values()) {
      if (node.kind === 'tag' && node.id !== tagId && !recommendedTagIds.includes(node.id)) {
        tags.push(node);
      }
    }
    return tags;
  }, [index, tagId, recommendedTagIds]);

  // Autocomplete suggestions based on query
  const autocompleteSuggestions = useMemo(() => {
    if (!autocompleteValue || !autocompleteValue.trim()) {
      return [];
    }
    if (!Array.isArray(availableTags)) {
      return [];
    }
    return availableTags
      .filter(tag => nodeMatchesQuery(tag, autocompleteValue))
      .slice(0, 10) // Limit to 10 suggestions
      .map(tag => ({
        value: getTagDisplayLabel(tag),
        tagId: tag.id,
      }));
  }, [availableTags, autocompleteValue]);

  // Autocomplete data - compute directly from autocompleteSuggestions
  // Use useMemo to ensure it's always an array and computed synchronously
  const autocompleteData = useMemo((): string[] => {
    if (!autocompleteSuggestions || !Array.isArray(autocompleteSuggestions)) {
      return [];
    }
    try {
      const result = autocompleteSuggestions
        .map(s => {
          if (!s || typeof s !== 'object' || !('value' in s)) {
            return '';
          }
          return String(s.value || '');
        })
        .filter((v): v is string => typeof v === 'string' && v.length > 0);
      return result;
    } catch (error) {
      return [];
    }
  }, [autocompleteSuggestions]);

  // Handle adding a recommended tag
  const handleAddRecommendedTag = (tagIdToAdd: string) => {
    if (!tagId) return;
    if (tagIdToAdd === tagId) {
      // Don't allow recommending self
      return;
    }
    if (recommendedTagIds.includes(tagIdToAdd)) {
      // Don't allow duplicates
      return;
    }
    setRecommendedTagIds([...recommendedTagIds, tagIdToAdd]);
    setAutocompleteValue('');
  };

  // Handle removing a recommended tag
  const handleRemoveRecommendedTag = (tagIdToRemove: string) => {
    setRecommendedTagIds(recommendedTagIds.filter(id => id !== tagIdToRemove));
  };

  // Handle autocomplete selection
  const handleAutocompleteSelect = (selectedLabel: string) => {
    const suggestion = autocompleteSuggestions.find(s => s.value === selectedLabel);
    if (suggestion) {
      handleAddRecommendedTag(suggestion.tagId);
    }
  };

  // Handle Enter key in autocomplete
  const handleAutocompleteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && autocompleteValue.trim()) {
      e.preventDefault();
      // Try to find exact match
      const suggestion = autocompleteSuggestions.find(s => 
        s.value.toLowerCase() === autocompleteValue.trim().toLowerCase()
      );
      if (suggestion) {
        handleAddRecommendedTag(suggestion.tagId);
      } else if (autocompleteSuggestions.length > 0) {
        // Use first suggestion if available
        handleAddRecommendedTag(autocompleteSuggestions[0].tagId);
      } else {
        // No match found - show light notification
        notifications.show({
          message: uiLanguage === 'zh' ? '未找到匹配的标签' : 'No matching tag found',
          color: 'gray',
          autoClose: 2000,
        });
      }
    }
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
    recommendedTags: uiLanguage === 'zh' ? '推荐标签' : 'Recommended Tags',
    recommendedTagsPlaceholder: uiLanguage === 'zh' ? '输入标签名称搜索...' : 'Type to search tags...',
    recommendedTagsHint: uiLanguage === 'zh' ? '选择其他标签作为推荐' : 'Select other tags as recommendations',
    cancel: uiLanguage === 'zh' ? '取消' : 'Cancel',
    save: uiLanguage === 'zh' ? '保存' : 'Save',
  };

  if (!tagId || !opened) {
    return null;
  }

  const node = index.byId.get(tagId);
  if (!node || node.kind !== 'tag') {
    return null;
  }

  // Ensure autocompleteData is always a valid array before rendering
  // Use useMemo to ensure stable reference and always return an array

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

        {/* Recommended Tags */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            {i18n.recommendedTags}
          </Text>
          <Stack gap="xs">
            {/* Display existing recommended tags as chips */}
            {recommendedTagIds.length > 0 && (
              <Group gap="xs" style={{ flexWrap: 'wrap' }}>
                {recommendedTagIds.map((recommendedId) => {
                  const recommendedNode = index.byId.get(recommendedId);
                  if (!recommendedNode) return null;
                  const displayLabel = getTagDisplayLabel(recommendedNode);
                  return (
                    <Badge
                      key={recommendedId}
                      variant="light"
                      rightSection={
                        <ActionIcon
                          size="xs"
                          color="blue"
                          radius="xl"
                          variant="transparent"
                          onClick={() => handleRemoveRecommendedTag(recommendedId)}
                          style={{ marginLeft: 4 }}
                        >
                          <X size={12} />
                        </ActionIcon>
                      }
                    >
                      {displayLabel}
                    </Badge>
                  );
                })}
              </Group>
            )}
            {/* Autocomplete input */}
            <Autocomplete
              value={autocompleteValue || ''}
              onChange={setAutocompleteValue}
              onOptionSubmit={handleAutocompleteSelect}
              onKeyDown={handleAutocompleteKeyDown}
              placeholder={i18n.recommendedTagsPlaceholder}
              // Mantine Autocomplete expects `filter` to return an array of options (not a boolean).
              // We already pre-filter via `nodeMatchesQuery`, so we simply return options unchanged.
              data={Array.isArray(autocompleteData) ? autocompleteData : []}
              filter={({ options }) => options}
              limit={10}
            />
            <Text size="xs" c="dimmed">
              {i18n.recommendedTagsHint}
            </Text>
          </Stack>
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

