import { create } from 'zustand';
import { AppPreferences } from '../types';

// ElectronAPI type is declared in ../types/index.ts

interface PreferencesStore {
  preferences: AppPreferences;
  isLoading: boolean;
  isElectron: boolean;

  // Actions
  loadPreferences: () => Promise<void>;
  savePreferences: (updates: Partial<AppPreferences>) => Promise<boolean>;
  selectHomeDirectory: () => Promise<string | null>;
  setHomeDirectory: (directory: string, migrateData?: boolean) => Promise<boolean>;
  getHomeDirectory: () => Promise<string>;
}

const defaultPreferences: AppPreferences = {
  homeDirectory: null,
  theme: 'dark',
  autoSave: true,
  maxHistoryItems: 100,
  customThemes: [],
};

export const usePreferencesStore = create<PreferencesStore>()((set, get) => ({
  preferences: defaultPreferences,
  isLoading: true,
  isElectron: typeof window !== 'undefined' && !!window.electronAPI,

  loadPreferences: async () => {
    const { isElectron } = get();

    if (isElectron && window.electronAPI) {
      try {
        const prefs = await window.electronAPI.getPreferences();
        if (prefs) {
          set({ preferences: { ...defaultPreferences, ...prefs }, isLoading: false });
        } else {
          set({ isLoading: false });
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
        set({ isLoading: false });
      }
    } else {
      // Browser mode - use localStorage
      try {
        const stored = localStorage.getItem('fetchy-preferences');
        if (stored) {
          set({ preferences: { ...defaultPreferences, ...JSON.parse(stored) }, isLoading: false });
        } else {
          set({ isLoading: false });
        }
      } catch (error) {
        console.error('Error loading preferences from localStorage:', error);
        set({ isLoading: false });
      }
    }
  },

  savePreferences: async (updates: Partial<AppPreferences>) => {
    const { isElectron, preferences } = get();
    const newPreferences = { ...preferences, ...updates };

    if (isElectron && window.electronAPI) {
      try {
        const success = await window.electronAPI.savePreferences(newPreferences);
        if (success) {
          set({ preferences: newPreferences });
        }
        return success;
      } catch (error) {
        console.error('Error saving preferences:', error);
        return false;
      }
    } else {
      // Browser mode - use localStorage
      try {
        localStorage.setItem('fetchy-preferences', JSON.stringify(newPreferences));
        set({ preferences: newPreferences });
        return true;
      } catch (error) {
        console.error('Error saving preferences to localStorage:', error);
        return false;
      }
    }
  },

  selectHomeDirectory: async () => {
    const { isElectron } = get();

    if (isElectron && window.electronAPI) {
      try {
        return await window.electronAPI.selectHomeDirectory();
      } catch (error) {
        console.error('Error selecting home directory:', error);
        return null;
      }
    }

    return null;
  },

  setHomeDirectory: async (directory: string, migrateData = false) => {
    const { isElectron, savePreferences } = get();

    if (isElectron && window.electronAPI) {
      try {
        // Get current home directory before changing
        const oldPath = await window.electronAPI.getHomeDirectory();

        // Migrate data if requested
        if (migrateData && oldPath !== directory) {
          const migrated = await window.electronAPI.migrateData({
            oldPath,
            newPath: directory,
          });

          if (!migrated) {
            console.error('Failed to migrate data');
            return false;
          }
        }

        // Save new home directory in preferences
        const success = await savePreferences({ homeDirectory: directory });
        return success;
      } catch (error) {
        console.error('Error setting home directory:', error);
        return false;
      }
    }

    // Browser mode - just save the preference (no actual file storage)
    return savePreferences({ homeDirectory: directory });
  },

  getHomeDirectory: async () => {
    const { isElectron, preferences } = get();

    if (isElectron && window.electronAPI) {
      try {
        return await window.electronAPI.getHomeDirectory();
      } catch (error) {
        console.error('Error getting home directory:', error);
        return preferences.homeDirectory || '';
      }
    }

    return preferences.homeDirectory || '';
  },
}));

