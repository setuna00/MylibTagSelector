/**
 * SearchResultsPanel
 *
 * Displays search results grouped by folders and tags.
 * - Shows up to 8 items per group
 * - Each item shows icon + label + path
 * - Clicking folder navigates to that folder
 * - Clicking tag navigates to tag's nearest ancestor folder
 */

import { useMemo } from 'react';
import { Paper, Stack, Text, Group, UnstyledButton } from '@mantine/core';
import { Folder, Tag } from 'lucide-react';
import type { NodeId, TaxonomyIndex, TagNode } from '@tagselector/tag-core';
import { nodeMatchesQuery, getTagDisplayLabel } from '../../utils/searchMatch';

interface SearchResultsPanelProps {
  index: TaxonomyIndex;
  query: string;
  onPickFolder: (id: NodeId | null) => void;
  onPickTag: (id: NodeId) => void;
}

/**
 * Build path string by traversing up the parent chain.
 * Returns "A / B / C" format.
 */
function buildPath(node: TagNode, index: TaxonomyIndex): string {
  const path: string[] = [];
  let current: TagNode | undefined = node;

  // Traverse up to root
  while (current) {
    path.unshift(current.label);
    if (!current.parentId) break;
    current = index.byId.get(current.parentId);
  }

  return path.join(' / ');
}

export function SearchResultsPanel({
  index,
  query,
  onPickFolder,
  onPickTag,
}: SearchResultsPanelProps) {
  // Return null if query is empty
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return null;
  }

  // Search nodes: iterate all nodes and filter by nodeMatchesQuery
  const allResults = useMemo(() => {
    const all = Array.from(index.byId.values());
    return all.filter(node => nodeMatchesQuery(node, trimmedQuery));
  }, [index, trimmedQuery]);

  // Group by kind
  const { folders, tags } = useMemo(() => {
    const folders: TagNode[] = [];
    const tags: TagNode[] = [];

    for (const node of allResults) {
      if (node.kind === 'folder') {
        folders.push(node);
      } else {
        tags.push(node);
      }
    }

    return {
      folders: folders.slice(0, 8), // Max 8 items
      tags: tags.slice(0, 8), // Max 8 items
    };
  }, [allResults]);

  // If no results, return null
  if (folders.length === 0 && tags.length === 0) {
    return null;
  }

  return (
    <Paper p="sm" withBorder>
      <Stack gap="xs">
        {/* Folders Section */}
        {folders.length > 0 && (
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
              文件夹
            </Text>
            <Stack gap="xs">
              {folders.map((folder) => (
                <UnstyledButton
                  key={folder.id}
                  onClick={() => onPickFolder(folder.id)}
                  style={{ width: '100%' }}
                >
                  <Paper p="xs" withBorder>
                    <Group gap="xs" wrap="nowrap">
                      <Folder size={14} />
                      <Text size="sm" style={{ flex: 1 }}>
                        {folder.label}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {buildPath(folder, index)}
                      </Text>
                    </Group>
                  </Paper>
                </UnstyledButton>
              ))}
            </Stack>
          </div>
        )}

        {/* Tags Section */}
        {tags.length > 0 && (
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
              标签
            </Text>
            <Stack gap="xs">
              {tags.map((tag) => (
                <UnstyledButton
                  key={tag.id}
                  onClick={() => onPickTag(tag.id)}
                  style={{ width: '100%' }}
                >
                  <Paper p="xs" withBorder>
                    <Group gap="xs" wrap="nowrap">
                      <Tag size={14} />
                      <Text size="sm" style={{ flex: 1 }}>
                        {getTagDisplayLabel(tag)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {buildPath(tag, index)}
                      </Text>
                    </Group>
                  </Paper>
                </UnstyledButton>
              ))}
            </Stack>
          </div>
        )}
      </Stack>
    </Paper>
  );
}

