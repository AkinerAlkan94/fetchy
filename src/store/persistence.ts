import { StateStorage } from 'zustand/middleware';
import { RequestHistoryItem, Collection, Environment } from '../types';

// Full storage export interface
export interface AppStorageExport {
  version: string;
  exportedAt: string;
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  history?: RequestHistoryItem[]; // Optional - not included in exports but may exist in imports
}

// Check if running in Electron
export const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

// Custom storage that uses Electron API when available, falling back to localStorage
export const createCustomStorage = (): StateStorage => {
  // For Electron environment, use file-based storage
  if (isElectron) {
    return {
      getItem: async (name: string): Promise<string | null> => {
        try {
          const result = await (window as any).electronAPI.readData(`${name}.json`);
          return result;
        } catch (error) {
          console.error('Error reading from file storage:', error);
          return null;
        }
      },
      setItem: async (name: string, value: string): Promise<void> => {
        try {
          await (window as any).electronAPI.writeData({
            filename: `${name}.json`,
            content: value,
          });
        } catch (error) {
          console.error('Error writing to file storage:', error);
        }
      },
      removeItem: async (name: string): Promise<void> => {
        try {
          // Write empty object to effectively remove the data
          await (window as any).electronAPI.writeData({
            filename: `${name}.json`,
            content: '{}',
          });
        } catch (error) {
          console.error('Error removing from file storage:', error);
        }
      },
    };
  }

  // Fallback to localStorage for browser environment
  return {
    getItem: (name: string): string | null => {
      return localStorage.getItem(name);
    },
    setItem: (name: string, value: string): void => {
      localStorage.setItem(name, value);
    },
    removeItem: (name: string): void => {
      localStorage.removeItem(name);
    },
  };
};
