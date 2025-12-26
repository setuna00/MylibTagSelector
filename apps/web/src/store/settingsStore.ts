/**
 * Settings Store
 *
 * Manages application settings including UI language and export label mode.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UILanguage = 'zh' | 'en';
export type ExportLabelMode = 'primary' | 'display';

interface SettingsState {
  uiLanguage: UILanguage;
  exportLabelMode: ExportLabelMode;
  isEditing: boolean;
}

interface SettingsActions {
  toggleLanguage: () => void;
  setLanguage: (lang: UILanguage) => void;
  setExportLabelMode: (mode: ExportLabelMode) => void;
  toggleEditing: () => void;
  setEditing: (isEditing: boolean) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      uiLanguage: 'zh',
      exportLabelMode: 'display',
      isEditing: false,

      toggleLanguage: () => {
        set((state) => ({
          uiLanguage: state.uiLanguage === 'zh' ? 'en' : 'zh',
        }));
      },

      setLanguage: (lang: UILanguage) => {
        set({ uiLanguage: lang });
      },

      setExportLabelMode: (mode: ExportLabelMode) => {
        set({ exportLabelMode: mode });
      },

      toggleEditing: () => {
        set((state) => ({
          isEditing: !state.isEditing,
        }));
      },

      setEditing: (isEditing: boolean) => {
        set({ isEditing });
      },
    }),
    {
      name: 'tagselector-settings',
    }
  )
);

