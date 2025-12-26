/**
 * CurrentFolderHeader
 *
 * Displays breadcrumb navigation showing the path to the current folder.
 * Allows navigation back to parent folders.
 */

import { useMemo } from 'react';
import { Breadcrumbs, Anchor, Text, Group, ActionIcon } from '@mantine/core';
import { Home, ChevronLeft } from 'lucide-react';
import type { NodeId, TaxonomyIndex } from '@tagselector/tag-core';
import styles from './CurrentFolderHeader.module.css';

interface CurrentFolderHeaderProps {
  index: TaxonomyIndex;
  currentFolderId: NodeId | null;
  onNavigateToFolder: (folderId: NodeId | null) => void;
}

export function CurrentFolderHeader({
  index,
  currentFolderId,
  onNavigateToFolder,
}: CurrentFolderHeaderProps) {
  // Build breadcrumb path from root to current folder
  const breadcrumbPath = useMemo(() => {
    const path: Array<{ id: NodeId | null; label: string }> = [];
    
    // Always start with Root
    path.push({ id: null, label: 'Root' });
    
    if (currentFolderId === null) {
      return path;
    }

    // Walk up the tree to build path
    const ancestors: Array<{ id: NodeId; label: string }> = [];
    let currentId: NodeId | null = currentFolderId;
    
    while (currentId !== null) {
      const node = index.byId.get(currentId);
      if (!node) break;
      ancestors.unshift({ id: node.id, label: node.label });
      currentId = node.parentId;
    }

    return [...path, ...ancestors];
  }, [index, currentFolderId]);

  const currentLabel = breadcrumbPath[breadcrumbPath.length - 1]?.label || 'Root';
  const canGoBack = breadcrumbPath.length > 1;
  const parentId = breadcrumbPath.length > 1 
    ? breadcrumbPath[breadcrumbPath.length - 2].id 
    : null;

  return (
    <div className={styles.container}>
      <Group gap="sm" wrap="nowrap">
        {/* Back button */}
        {canGoBack && (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => onNavigateToFolder(parentId)}
            aria-label="Go back"
          >
            <ChevronLeft size={16} />
          </ActionIcon>
        )}

        {/* Breadcrumbs */}
        <Breadcrumbs separator=">" className={styles.breadcrumbs}>
          {breadcrumbPath.map((item, idx) => {
            const isLast = idx === breadcrumbPath.length - 1;
            
            if (isLast) {
              return (
                <Text key={item.id ?? '__root__'} fw={600} size="sm">
                  {item.id === null && <Home size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                  {item.label}
                </Text>
              );
            }

            return (
              <Anchor
                key={item.id ?? '__root__'}
                size="sm"
                onClick={() => onNavigateToFolder(item.id)}
                className={styles.breadcrumbLink}
              >
                {item.id === null && <Home size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                {item.label}
              </Anchor>
            );
          })}
        </Breadcrumbs>
      </Group>

      {/* Current folder title */}
      <Text size="lg" fw={700} mt="xs">
        📂 {currentLabel}
      </Text>
    </div>
  );
}

