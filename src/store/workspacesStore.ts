import { create } from 'zustand';
import { Workspace, WorkspacesConfig, WorkspaceExport } from '../types';

interface WorkspacesStore {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  isElectron: boolean;

  // Load workspaces config from disk (Electron) or localStorage (browser)
  loadWorkspaces: () => Promise<void>;

  // Add a new workspace with explicit home + secrets directories
  addWorkspace: (name: string, homeDirectory: string, secretsDirectory: string) => Promise<Workspace>;

  // Remove workspace by id (does NOT delete files on disk)
  removeWorkspace: (id: string) => Promise<void>;

  // Switch active workspace and reload the app
  switchWorkspace: (id: string) => Promise<void>;

  // Update workspace name / directories
  updateWorkspace: (id: string, updates: Partial<Pick<Workspace, 'name' | 'homeDirectory' | 'secretsDirectory'>>) => Promise<void>;

  // Export workspace data as a JSON file (Electron only)
  exportWorkspace: (id: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;

  // Import a workspace from a JSON export: write files, register workspace
  importWorkspaceFromFile: () => Promise<{ success: boolean; error?: string }>;

  // Get workspace by id
  getWorkspace: (id: string) => Workspace | null;

  // Handy selector
  activeWorkspace: () => Workspace | null;
}

const BROWSER_STORAGE_KEY = 'fetchy-workspaces';

function generateBrowserId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useWorkspacesStore = create<WorkspacesStore>()((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  isLoading: true,
  isElectron: typeof window !== 'undefined' && !!window.electronAPI,

  loadWorkspaces: async () => {
    const { isElectron } = get();

    if (isElectron && window.electronAPI) {
      try {
        const config: WorkspacesConfig = await window.electronAPI.getWorkspaces();
        set({
          workspaces: config.workspaces ?? [],
          activeWorkspaceId: config.activeWorkspaceId ?? null,
          isLoading: false,
        });
      } catch (error) {
        console.error('Error loading workspaces:', error);
        set({ isLoading: false });
      }
    } else {
      try {
        const stored = localStorage.getItem(BROWSER_STORAGE_KEY);
        if (stored) {
          const config: WorkspacesConfig = JSON.parse(stored);
          set({
            workspaces: config.workspaces ?? [],
            activeWorkspaceId: config.activeWorkspaceId ?? null,
            isLoading: false,
          });
        } else {
          set({ isLoading: false });
        }
      } catch {
        set({ isLoading: false });
      }
    }
  },

  addWorkspace: async (name, homeDirectory, secretsDirectory) => {
    const { isElectron, workspaces, activeWorkspaceId } = get();

    const newWorkspace: Workspace = {
      id: isElectron ? crypto.randomUUID() : generateBrowserId(),
      name,
      homeDirectory,
      secretsDirectory,
      createdAt: Date.now(),
    };

    const newWorkspaces = [...workspaces, newWorkspace];
    // Auto-activate if this is the first workspace or no workspace is currently active
    const newActiveId = activeWorkspaceId ?? newWorkspace.id;
    const config: WorkspacesConfig = {
      workspaces: newWorkspaces,
      activeWorkspaceId: newActiveId,
    };

    if (isElectron && window.electronAPI) {
      await window.electronAPI.saveWorkspaces(config);
    } else {
      localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(config));
    }

    set({ workspaces: newWorkspaces, activeWorkspaceId: newActiveId });
    return newWorkspace;
  },

  removeWorkspace: async (id) => {
    const { isElectron, workspaces, activeWorkspaceId } = get();

    const newWorkspaces = workspaces.filter((w) => w.id !== id);
    const newActiveId =
      activeWorkspaceId === id
        ? (newWorkspaces[0]?.id ?? null)
        : activeWorkspaceId;

    const config: WorkspacesConfig = {
      workspaces: newWorkspaces,
      activeWorkspaceId: newActiveId,
    };

    if (isElectron && window.electronAPI) {
      await window.electronAPI.saveWorkspaces(config);
    } else {
      localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(config));
    }

    set({ workspaces: newWorkspaces, activeWorkspaceId: newActiveId });

    // If the active workspace changed, reload
    if (activeWorkspaceId === id) {
      setTimeout(() => window.location.reload(), 300);
    }
  },

  switchWorkspace: async (id) => {
    const { isElectron, workspaces, activeWorkspaceId } = get();
    if (id === activeWorkspaceId) return;

    const config: WorkspacesConfig = { workspaces, activeWorkspaceId: id };

    if (isElectron && window.electronAPI) {
      await window.electronAPI.saveWorkspaces(config);
    } else {
      localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(config));
    }

    set({ activeWorkspaceId: id });
    // Reload to reinitialise stores with the new workspace's data
    setTimeout(() => window.location.reload(), 200);
  },

  updateWorkspace: async (id, updates) => {
    const { isElectron, workspaces, activeWorkspaceId } = get();

    const newWorkspaces = workspaces.map((w) =>
      w.id === id ? { ...w, ...updates } : w
    );
    const config: WorkspacesConfig = { workspaces: newWorkspaces, activeWorkspaceId };

    if (isElectron && window.electronAPI) {
      await window.electronAPI.saveWorkspaces(config);
    } else {
      localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(config));
    }

    set({ workspaces: newWorkspaces });

    // If the active workspace's directories changed, reload
    if (id === activeWorkspaceId && (updates.homeDirectory || updates.secretsDirectory)) {
      setTimeout(() => window.location.reload(), 300);
    }
  },

  exportWorkspace: async (id) => {
    const { isElectron } = get();

    if (!isElectron || !window.electronAPI) {
      return { success: false, error: 'Export to file is only available in the desktop app.' };
    }

    return window.electronAPI.exportWorkspaceToJson({ workspaceId: id });
  },

  importWorkspaceFromFile: async () => {
    const { isElectron } = get();

    if (!isElectron || !window.electronAPI) {
      return { success: false, error: 'Import from file is only available in the desktop app.' };
    }

    // Step 1: Open the JSON file
    const fileResult = await window.electronAPI.openFile({
      filters: [{ name: 'Fetchy Workspace JSON', extensions: ['json'] }],
    });
    if (!fileResult) return { success: false, error: 'No file selected.' };

    let exportData: WorkspaceExport;
    try {
      exportData = JSON.parse(fileResult.content);
      if (!exportData.fetchyWorkspaceExport) {
        return { success: false, error: 'This file is not a valid Fetchy workspace export.' };
      }
    } catch {
      return { success: false, error: 'Invalid JSON file.' };
    }

    // Step 2: Ask for home directory
    const homeDirectory = await window.electronAPI.selectDirectory({
      title: 'Select Home Directory for Imported Workspace',
    });
    if (!homeDirectory) return { success: false, error: 'Home directory not selected.' };

    // Step 3: Ask for secrets directory
    const secretsDirectory = await window.electronAPI.selectDirectory({
      title: 'Select Secrets Directory for Imported Workspace',
    });
    if (!secretsDirectory) return { success: false, error: 'Secrets directory not selected.' };

    // Step 4: Import
    const name = exportData.workspaceName || 'Imported Workspace';
    const result = await window.electronAPI.importWorkspaceFromJson({
      name,
      homeDirectory,
      secretsDirectory,
      exportData,
    });

    if (!result.success) return { success: false, error: result.error };

    // Refresh workspaces list
    await get().loadWorkspaces();
    return { success: true };
  },

  getWorkspace: (id) => {
    return get().workspaces.find((w) => w.id === id) ?? null;
  },

  activeWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  },
}));
