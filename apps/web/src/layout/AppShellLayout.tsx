/**
 * AppShellLayout
 *
 * Pure layout component for Desktop/Mobile responsive structure.
 * Does not access any zustand stores or contain business logic.
 *
 * Phase 2 Layout (Updated):
 * Desktop Right Panel Structure:
 * - Error Bar (optional): Non-intrusive validation error display
 * - Fixed Top: Import/Export + Current Folder Header
 * - Scrollable Middle: Recommendations + CurrentLevelView (ONLY this section scrolls)
 * - Fixed Bottom: Selection + ExportPreview (always visible, never pushed off screen)
 *
 * Key Layout Fix:
 * - Right column uses flex column with overflow:hidden
 * - Middle section has flex:1 + minHeight:0 + overflow:auto
 * - Bottom section has flexShrink:0 to stay visible
 * - ExportPreview output box scrolls internally if too long
 */

import type { ReactNode } from 'react';
import { AppShell, Paper, Stack, Tabs } from '@mantine/core';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useSettingsStore } from '../store';

interface AppShellLayoutProps {
  isDesktop: boolean;
  // Slot contents (without Paper wrappers)
  searchSection: ReactNode;
  treeSection: ReactNode;
  quickSetsSection?: ReactNode;
  importExportSection: ReactNode;
  currentFolderHeader?: ReactNode;
  mainWorkArea?: ReactNode;
  selectionSection: ReactNode;
  exportPreviewSection: ReactNode;
  /** Optional error bar shown at top of right panel (non-intrusive) */
  errorBarSection?: ReactNode;
  /** Optional section rendered above selectionSection in fixed bottom area */
  bottomAboveSelectionSection?: ReactNode;
  /**
   * Optional replacement for the entire bottom fixed section.
   * When provided, replaces selectionSection + exportPreviewSection completely.
   * Used for QuickSet editing mode.
   */
  bottomModeSection?: ReactNode;
  /** Optional section rendered at bottom of left panel (Desktop only, after QuickSets) */
  leftBottomSection?: ReactNode;
}

export function AppShellLayout({
  isDesktop,
  searchSection,
  treeSection,
  quickSetsSection,
  importExportSection,
  currentFolderHeader,
  mainWorkArea,
  selectionSection,
  exportPreviewSection,
  errorBarSection,
  bottomAboveSelectionSection,
  bottomModeSection,
  leftBottomSection,
}: AppShellLayoutProps) {
  const { uiLanguage } = useSettingsStore();
  // Desktop 双栏布局
  if (isDesktop) {
    return (
      <AppShell>
        <AppShell.Main style={{ height: '100vh', padding: 0 }}>
          <PanelGroup direction="horizontal" style={{ height: '100%' }}>
            {/* 左栏：SearchBar + FolderNavigator + QuickSets */}
            <Panel defaultSize={35} minSize={20}>
              <Stack gap="md" style={{ height: '100%', padding: '16px', overflow: 'hidden' }}>
                {/* Fixed top: Search header */}
                <Paper p="md" withBorder style={{ flexShrink: 0 }}>
                  <Stack gap="sm">
                    <h2 style={{ margin: 0, fontSize: '16px' }}>
                      {uiLanguage === 'zh' ? '文件夹导航' : 'Folder Navigation'}
                    </h2>
                    {searchSection}
                  </Stack>
                </Paper>
                {/* Scrollable middle: Folder tree (only this scrolls) */}
                <Paper p="md" withBorder style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{treeSection}</div>
                </Paper>
                {/* Fixed bottom: QuickSets (always visible, taller default) */}
                {quickSetsSection && (
                  <div
                    style={{
                      flexShrink: 0,
                      minHeight: 260,
                      maxHeight: '35%',
                      overflow: 'auto',
                    }}
                  >
                    {quickSetsSection}
                  </div>
                )}
                {/* Fixed bottom: Left bottom section (after QuickSets, always visible) */}
                {leftBottomSection && (
                  <div style={{ flexShrink: 0 }}>
                    {leftBottomSection}
                  </div>
                )}
              </Stack>
            </Panel>

            {/* 拖拽手柄 */}
            <PanelResizeHandle
              style={{
                width: '6px',
                minWidth: '6px',
                cursor: 'col-resize',
                backgroundColor: 'transparent',
                transition: 'background-color 0.2s',
              }}
            />

            {/* 右栏：Fixed header/footer + scrollable middle */}
            <Panel defaultSize={65} minSize={35}>
              <div
                style={{
                  height: '100%',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  overflow: 'hidden', // Critical: prevent column scroll
                }}
              >
                {/* Error Bar (optional, non-intrusive) */}
                {errorBarSection && (
                  <div style={{ flexShrink: 0 }}>
                    {errorBarSection}
                  </div>
                )}

                {/* Fixed Top: Import/Export + Header */}
                <div style={{ flexShrink: 0 }}>
                  <Stack gap="sm">
                    <Paper p="sm" withBorder>
                      {importExportSection}
                    </Paper>
                    {currentFolderHeader && (
                      <Paper p="sm" withBorder>
                        {currentFolderHeader}
                      </Paper>
                    )}
                  </Stack>
                </div>

                {/* Scrollable Middle: Main Work Area (ONLY this scrolls) */}
                {mainWorkArea && (
                  <Paper
                    p="md"
                    withBorder
                    style={{
                      flex: 1,
                      minHeight: 0, // Critical: allow flex item to shrink
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto', // Only this div scrolls
                      }}
                    >
                      {mainWorkArea}
                    </div>
                  </Paper>
                )}

                {/* Fixed Bottom: Either bottomModeSection (replaces all) or default sections */}
                <div style={{ flexShrink: 0 }}>
                  {bottomModeSection ? (
                    // QuickSet editing mode: replace entire bottom section
                    <Paper p="sm" withBorder>
                      {bottomModeSection}
                    </Paper>
                  ) : (
                    // Normal mode: show selection + export preview
                    <Stack gap="sm">
                      {bottomAboveSelectionSection && (
                        <Paper p="sm" withBorder>
                          {bottomAboveSelectionSection}
                        </Paper>
                      )}
                      <Paper p="sm" withBorder>
                        {selectionSection}
                      </Paper>
                      <Paper
                        p="sm"
                        withBorder
                        style={{
                          maxHeight: '180px', // Limit height
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            marginBottom: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--mantine-color-dimmed)',
                            flexShrink: 0,
                          }}
                        >
                          {uiLanguage === 'zh' ? '导出预览' : 'Export Preview'}
                        </h3>
                        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                          {exportPreviewSection}
                        </div>
                      </Paper>
                    </Stack>
                  )}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </AppShell.Main>
      </AppShell>
    );
  }

  // Mobile Tabs 布局 (保持不变)
  return (
    <AppShell>
      <AppShell.Main style={{ height: '100vh', padding: 0 }}>
        <Tabs defaultValue="taxonomy" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Tabs.List>
            <Tabs.Tab value="taxonomy">Taxonomy</Tabs.Tab>
            <Tabs.Tab value="browse">Browse</Tabs.Tab>
            <Tabs.Tab value="output">Output</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="taxonomy" style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <Stack gap="md">
              {/* Error bar on mobile too */}
              {errorBarSection && errorBarSection}
              <Paper p="md" withBorder>
                <Stack gap="sm">
                  <h2 style={{ margin: 0 }}>Taxonomy Tree</h2>
                  {searchSection}
                </Stack>
              </Paper>
              <Paper p="md" withBorder>
                {treeSection}
              </Paper>
              {quickSetsSection && quickSetsSection}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="browse" style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <Stack gap="md">
              {currentFolderHeader && (
                <Paper p="md" withBorder>
                  {currentFolderHeader}
                </Paper>
              )}
              {mainWorkArea && (
                <Paper p="md" withBorder>
                  {mainWorkArea}
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="output" style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <Stack gap="md">
              <Paper p="md" withBorder>
                {importExportSection}
              </Paper>
              {bottomModeSection ? (
                // QuickSet editing mode: replace bottom sections
                <Paper p="md" withBorder>
                  {bottomModeSection}
                </Paper>
              ) : (
                // Normal mode
                <>
                  {bottomAboveSelectionSection && (
                    <Paper p="md" withBorder>
                      {bottomAboveSelectionSection}
                    </Paper>
                  )}
                  <Paper p="md" withBorder>
                    {selectionSection}
                  </Paper>
                  <Paper p="md" withBorder>
                    <h2 style={{ marginTop: 0 }}>Export Preview</h2>
                    {exportPreviewSection}
                  </Paper>
                </>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </AppShell.Main>
    </AppShell>
  );
}
