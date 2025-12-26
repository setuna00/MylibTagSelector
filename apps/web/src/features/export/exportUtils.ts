import { useMemo } from 'react';
import type { NodeId, TaxonomyIndex } from '@tagselector/tag-core';
import { computeExportSet, sortByUserOrder, formatForMylio } from '@tagselector/tag-core';

// Hook to get export text for copying
export function useExportText(
  index: TaxonomyIndex | null,
  selectedIds: Set<NodeId>
): string {
  return useMemo(() => {
    if (!index || selectedIds.size === 0) return '';
    const exportSet = computeExportSet(index, selectedIds);
    const sortedIds = sortByUserOrder(index, exportSet);
    return formatForMylio(index, sortedIds);
  }, [index, selectedIds]);
}
