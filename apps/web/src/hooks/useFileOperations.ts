/**
 * useFileOperations Hook
 *
 * Handles project pack import/export operations with notifications.
 * 
 * Import: loads taxonomy + restores rules from meta.extensions.rules
 * Export: saves taxonomy + rules as project pack (meta.extensions.rules)
 */

import { useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { useTaxonomyStore } from '../store/taxonomyStore';
import { useRulesStore } from '../store/rulesStore';
import { getExtensions } from '../utils/extensions';

interface UseFileOperationsOptions {
  onImportSuccess: () => void;
}

export function useFileOperations({
  onImportSuccess,
}: UseFileOperationsOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear file input first to allow re-selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      const text = await file.text();
      const result = useTaxonomyStore.getState().loadTaxonomy(text);

      if (result.ok) {
        // Extract rules from imported taxonomy's extensions
        const { taxonomy } = result;
        const extensions = getExtensions(taxonomy);
        const rules = extensions.rules?.savedRules ?? [];
        
        // Get the newly built index (loadTaxonomy already updated it)
        const currentIndex = useTaxonomyStore.getState().index;
        
        // Restore rules (or clear if none in import)
        useRulesStore.getState().setSavedRules(rules, currentIndex);

        notifications.show({
          message: '项目导入成功',
          color: 'green',
          autoClose: 3000,
        });
        // Clear selection after successful import
        onImportSuccess();
      } else {
        notifications.show({
          message: `导入失败: ${result.error}`,
          color: 'red',
          autoClose: 3000,
        });
      }
    } catch (err) {
      notifications.show({
        message: err instanceof Error ? err.message : '导入失败',
        color: 'red',
        autoClose: 3000,
      });
    }
  };

  const handleExport = () => {
    const jsonString = useTaxonomyStore.getState().exportProjectPack();
    if (!jsonString) {
      notifications.show({
        message: '没有可导出的项目数据',
        color: 'red',
        autoClose: 3000,
      });
      return;
    }

    try {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `project-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notifications.show({
        message: '项目导出成功',
        color: 'green',
        autoClose: 3000,
      });
    } catch (err) {
      notifications.show({
        message: err instanceof Error ? err.message : '导出失败',
        color: 'red',
        autoClose: 3000,
      });
    }
  };

  return { handleImport, handleExport, fileInputRef };
}

