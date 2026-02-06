import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import {
  Collection,
  Environment,
  ApiRequest,
  RequestFolder,
  TabState,
  RequestHistoryItem,
  HttpMethod,
} from '../types';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

// Full storage export interface
export interface AppStorageExport {
  version: string;
  exportedAt: string;
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  history: RequestHistoryItem[];
}

// Custom storage that uses Electron API when available
const createCustomStorage = (): StateStorage => {
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

interface AppStore {
  // Collections
  collections: Collection[];
  addCollection: (name: string, description?: string) => Collection;
  updateCollection: (id: string, updates: Partial<Collection>) => void;
  deleteCollection: (id: string) => void;
  reorderCollections: (fromIndex: number, toIndex: number) => void;

  // Folders
  addFolder: (collectionId: string, parentFolderId: string | null, name: string) => void;
  updateFolder: (collectionId: string, folderId: string, updates: Partial<RequestFolder>) => void;
  deleteFolder: (collectionId: string, folderId: string) => void;
  toggleFolderExpanded: (collectionId: string, folderId: string) => void;
  reorderFolders: (collectionId: string, parentFolderId: string | null, fromIndex: number, toIndex: number) => void;
  moveFolder: (
    sourceCollectionId: string,
    targetCollectionId: string,
    folderId: string,
    targetIndex?: number
  ) => void;

  // Requests
  addRequest: (collectionId: string, folderId: string | null, request?: Partial<ApiRequest>) => ApiRequest;
  updateRequest: (collectionId: string, requestId: string, updates: Partial<ApiRequest>) => void;
  deleteRequest: (collectionId: string, requestId: string) => void;
  getRequest: (collectionId: string, requestId: string) => ApiRequest | null;
  duplicateRequest: (collectionId: string, requestId: string) => void;
  reorderRequests: (collectionId: string, folderId: string | null, fromIndex: number, toIndex: number) => void;
  moveRequest: (
    sourceCollectionId: string,
    sourceFolderId: string | null,
    targetCollectionId: string,
    targetFolderId: string | null,
    requestId: string,
    targetIndex?: number
  ) => void;

  // Environments
  environments: Environment[];
  activeEnvironmentId: string | null;
  addEnvironment: (name: string) => Environment;
  updateEnvironment: (id: string, updates: Partial<Environment>) => void;
  deleteEnvironment: (id: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  getActiveEnvironment: () => Environment | null;
  duplicateEnvironment: (id: string) => Environment | null;
  importEnvironment: (environment: Environment) => Environment;

  // Tabs
  tabs: TabState[];
  activeTabId: string | null;
  openTab: (tab: Omit<TabState, 'id'>) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<TabState>) => void;

  // History
  history: RequestHistoryItem[];
  addToHistory: (item: Omit<RequestHistoryItem, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;

  // Active request (for the current working request)
  activeRequest: ApiRequest | null;
  setActiveRequest: (request: ApiRequest | null) => void;

  // Sidebar
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;

  // Panel widths
  requestPanelWidth: number;
  setRequestPanelWidth: (width: number) => void;

  // Panel layout
  panelLayout: 'horizontal' | 'vertical';
  setPanelLayout: (layout: 'horizontal' | 'vertical') => void;
  togglePanelLayout: () => void;

  // Import/Export
  importCollection: (collection: Collection) => void;
  exportCollection: (id: string) => Collection | null;

  // Full app storage export/import
  exportFullStorage: () => AppStorageExport;
  importFullStorage: (data: AppStorageExport) => void;

  // Toggle collection expanded
  toggleCollectionExpanded: (id: string) => void;
}

const createDefaultRequest = (overrides?: Partial<ApiRequest>): ApiRequest => ({
  id: uuidv4(),
  name: 'New Request',
  method: 'GET' as HttpMethod,
  url: '',
  headers: [],
  params: [],
  body: { type: 'none' },
  auth: { type: 'none' },
  ...overrides,
});

const findAndUpdateRequest = (
  folders: RequestFolder[],
  requests: ApiRequest[],
  requestId: string,
  updates: Partial<ApiRequest>
): { folders: RequestFolder[]; requests: ApiRequest[]; found: boolean } => {
  // Check in requests array
  const reqIndex = requests.findIndex(r => r.id === requestId);
  if (reqIndex !== -1) {
    const updatedRequests = [...requests];
    updatedRequests[reqIndex] = { ...updatedRequests[reqIndex], ...updates };
    return { folders, requests: updatedRequests, found: true };
  }

  // Check in folders
  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const result = findAndUpdateRequest(folder.folders, folder.requests, requestId, updates);
    if (result.found) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folder, folders: result.folders, requests: result.requests };
      return { folders: updatedFolders, requests, found: true };
    }
  }

  return { folders, requests, found: false };
};

const findRequest = (
  folders: RequestFolder[],
  requests: ApiRequest[],
  requestId: string
): ApiRequest | null => {
  const req = requests.find(r => r.id === requestId);
  if (req) return req;

  for (const folder of folders) {
    const found = findRequest(folder.folders, folder.requests, requestId);
    if (found) return found;
  }

  return null;
};

const findAndDeleteRequest = (
  folders: RequestFolder[],
  requests: ApiRequest[],
  requestId: string
): { folders: RequestFolder[]; requests: ApiRequest[]; found: boolean } => {
  const reqIndex = requests.findIndex(r => r.id === requestId);
  if (reqIndex !== -1) {
    return { folders, requests: requests.filter(r => r.id !== requestId), found: true };
  }

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const result = findAndDeleteRequest(folder.folders, folder.requests, requestId);
    if (result.found) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folder, folders: result.folders, requests: result.requests };
      return { folders: updatedFolders, requests, found: true };
    }
  }

  return { folders, requests, found: false };
};

const findAndUpdateFolder = (
  folders: RequestFolder[],
  folderId: string,
  updates: Partial<RequestFolder>
): { folders: RequestFolder[]; found: boolean } => {
  for (let i = 0; i < folders.length; i++) {
    if (folders[i].id === folderId) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folders[i], ...updates };
      return { folders: updatedFolders, found: true };
    }

    const result = findAndUpdateFolder(folders[i].folders, folderId, updates);
    if (result.found) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folders[i], folders: result.folders };
      return { folders: updatedFolders, found: true };
    }
  }

  return { folders, found: false };
};

const findAndDeleteFolder = (
  folders: RequestFolder[],
  folderId: string
): { folders: RequestFolder[]; found: boolean } => {
  const folderIndex = folders.findIndex(f => f.id === folderId);
  if (folderIndex !== -1) {
    return { folders: folders.filter(f => f.id !== folderId), found: true };
  }

  for (let i = 0; i < folders.length; i++) {
    const result = findAndDeleteFolder(folders[i].folders, folderId);
    if (result.found) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folders[i], folders: result.folders };
      return { folders: updatedFolders, found: true };
    }
  }

  return { folders, found: false };
};

const addRequestToFolder = (
  folders: RequestFolder[],
  folderId: string,
  request: ApiRequest
): { folders: RequestFolder[]; found: boolean } => {
  for (let i = 0; i < folders.length; i++) {
    if (folders[i].id === folderId) {
      const updatedFolders = [...folders];
      updatedFolders[i] = {
        ...folders[i],
        requests: [...folders[i].requests, request],
      };
      return { folders: updatedFolders, found: true };
    }

    const result = addRequestToFolder(folders[i].folders, folderId, request);
    if (result.found) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folders[i], folders: result.folders };
      return { folders: updatedFolders, found: true };
    }
  }

  return { folders, found: false };
};

const addSubFolder = (
  folders: RequestFolder[],
  parentFolderId: string,
  newFolder: RequestFolder
): { folders: RequestFolder[]; found: boolean } => {
  for (let i = 0; i < folders.length; i++) {
    if (folders[i].id === parentFolderId) {
      const updatedFolders = [...folders];
      updatedFolders[i] = {
        ...folders[i],
        folders: [...folders[i].folders, newFolder],
      };
      return { folders: updatedFolders, found: true };
    }

    const result = addSubFolder(folders[i].folders, parentFolderId, newFolder);
    if (result.found) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folders[i], folders: result.folders };
      return { folders: updatedFolders, found: true };
    }
  }

  return { folders, found: false };
};

export const useAppStore = create<AppStore>()(
  persist(
    immer((set, get) => ({
      // Collections
      collections: [],

      addCollection: (name: string, description?: string) => {
        const collection: Collection = {
          id: uuidv4(),
          name,
          description,
          folders: [],
          requests: [],
          variables: [],
          expanded: true,
        };
        set(state => {
          state.collections.push(collection);
        });
        return collection;
      },

      updateCollection: (id: string, updates: Partial<Collection>) => {
        set(state => {
          const index = state.collections.findIndex(c => c.id === id);
          if (index !== -1) {
            state.collections[index] = { ...state.collections[index], ...updates };
          }
        });
      },

      deleteCollection: (id: string) => {
        set(state => {
          state.collections = state.collections.filter(c => c.id !== id);
          state.tabs = state.tabs.filter(t => t.collectionId !== id);
        });
      },

      reorderCollections: (fromIndex: number, toIndex: number) => {
        set(state => {
          const [removed] = state.collections.splice(fromIndex, 1);
          state.collections.splice(toIndex, 0, removed);
        });
      },

      toggleCollectionExpanded: (id: string) => {
        set(state => {
          const index = state.collections.findIndex(c => c.id === id);
          if (index !== -1) {
            state.collections[index].expanded = !state.collections[index].expanded;
          }
        });
      },

      // Folders
      addFolder: (collectionId: string, parentFolderId: string | null, name: string) => {
        const newFolder: RequestFolder = {
          id: uuidv4(),
          name,
          requests: [],
          folders: [],
          expanded: true,
        };

        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;

          if (parentFolderId === null) {
            state.collections[collectionIndex].folders.push(newFolder);
          } else {
            const result = addSubFolder(
              state.collections[collectionIndex].folders,
              parentFolderId,
              newFolder
            );
            if (result.found) {
              state.collections[collectionIndex].folders = result.folders;
            }
          }
        });
      },

      updateFolder: (collectionId: string, folderId: string, updates: Partial<RequestFolder>) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;

          const result = findAndUpdateFolder(
            state.collections[collectionIndex].folders,
            folderId,
            updates
          );
          if (result.found) {
            state.collections[collectionIndex].folders = result.folders;
          }
        });
      },

      deleteFolder: (collectionId: string, folderId: string) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;

          const result = findAndDeleteFolder(
            state.collections[collectionIndex].folders,
            folderId
          );
          if (result.found) {
            state.collections[collectionIndex].folders = result.folders;
          }
        });
      },

      toggleFolderExpanded: (collectionId: string, folderId: string) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;

          // Toggle folder expansion recursively
          const toggleFolder = (folders: RequestFolder[]): RequestFolder[] => {
            return folders.map(f => {
              if (f.id === folderId) {
                return { ...f, expanded: !f.expanded };
              }
              return { ...f, folders: toggleFolder(f.folders) };
            });
          };

          state.collections[collectionIndex].folders = toggleFolder(
            state.collections[collectionIndex].folders
          );
        });
      },

      reorderFolders: (collectionId: string, parentFolderId: string | null, fromIndex: number, toIndex: number) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;

          if (parentFolderId === null) {
            // Reorder folders at collection root level
            const [removed] = state.collections[collectionIndex].folders.splice(fromIndex, 1);
            state.collections[collectionIndex].folders.splice(toIndex, 0, removed);
          } else {
            // Reorder folders within a parent folder
            const reorderInFolder = (folders: RequestFolder[]): RequestFolder[] => {
              return folders.map(f => {
                if (f.id === parentFolderId) {
                  const newFolders = [...f.folders];
                  const [removed] = newFolders.splice(fromIndex, 1);
                  newFolders.splice(toIndex, 0, removed);
                  return { ...f, folders: newFolders };
                }
                return { ...f, folders: reorderInFolder(f.folders) };
              });
            };
            state.collections[collectionIndex].folders = reorderInFolder(
              state.collections[collectionIndex].folders
            );
          }
        });
      },

      moveFolder: (
        sourceCollectionId: string,
        targetCollectionId: string,
        folderId: string,
        targetIndex?: number
      ) => {
        const state = get();

        // Find the folder first
        const sourceCollection = state.collections.find(c => c.id === sourceCollectionId);
        if (!sourceCollection) return;

        // Find and extract the folder
        const findFolder = (folders: RequestFolder[]): RequestFolder | null => {
          for (const folder of folders) {
            if (folder.id === folderId) return folder;
            const found = findFolder(folder.folders);
            if (found) return found;
          }
          return null;
        };

        const folder = findFolder(sourceCollection.folders);
        if (!folder) return;

        set(s => {
          // Remove from source collection
          const sourceColIndex = s.collections.findIndex(c => c.id === sourceCollectionId);
          if (sourceColIndex === -1) return;

          const deleteResult = findAndDeleteFolder(
            s.collections[sourceColIndex].folders,
            folderId
          );

          if (deleteResult.found) {
            s.collections[sourceColIndex].folders = deleteResult.folders;
          }

          // Add to target collection
          const targetColIndex = s.collections.findIndex(c => c.id === targetCollectionId);
          if (targetColIndex === -1) return;

          if (targetIndex !== undefined) {
            s.collections[targetColIndex].folders.splice(targetIndex, 0, folder);
          } else {
            s.collections[targetColIndex].folders.push(folder);
          }

          // Update any open tabs that reference requests in this folder
          const updateTabsForFolder = (folderToCheck: RequestFolder) => {
            folderToCheck.requests.forEach(req => {
              s.tabs = s.tabs.map(t => {
                if (t.requestId === req.id) {
                  return { ...t, collectionId: targetCollectionId };
                }
                return t;
              });
            });
            folderToCheck.folders.forEach(subFolder => updateTabsForFolder(subFolder));
          };
          updateTabsForFolder(folder);
        });
      },

      // Requests
      addRequest: (collectionId: string, folderId: string | null, request?: Partial<ApiRequest>) => {
        const newRequest = createDefaultRequest(request);

        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;

          if (folderId === null) {
            state.collections[collectionIndex].requests.push(newRequest);
          } else {
            const result = addRequestToFolder(
              state.collections[collectionIndex].folders,
              folderId,
              newRequest
            );
            if (result.found) {
              state.collections[collectionIndex].folders = result.folders;
            }
          }
        });

        return newRequest;
      },

      updateRequest: (collectionId: string, requestId: string, updates: Partial<ApiRequest>) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;

          const result = findAndUpdateRequest(
            state.collections[collectionIndex].folders,
            state.collections[collectionIndex].requests,
            requestId,
            updates
          );

          if (result.found) {
            state.collections[collectionIndex].folders = result.folders;
            state.collections[collectionIndex].requests = result.requests;

            // If the request name was updated, update any open tabs
            if (updates.name) {
              state.tabs = state.tabs.map(tab => {
                if (tab.type === 'request' && tab.requestId === requestId) {
                  return { ...tab, title: updates.name!, isModified: false };
                }
                return tab;
              });
            }
          }
        });
      },

      deleteRequest: (collectionId: string, requestId: string) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;

          const result = findAndDeleteRequest(
            state.collections[collectionIndex].folders,
            state.collections[collectionIndex].requests,
            requestId
          );

          if (result.found) {
            state.collections[collectionIndex].folders = result.folders;
            state.collections[collectionIndex].requests = result.requests;
          }

          state.tabs = state.tabs.filter(t => t.requestId !== requestId);
        });
      },

      getRequest: (collectionId: string, requestId: string) => {
        const state = get();
        const collection = state.collections.find(c => c.id === collectionId);
        if (!collection) return null;

        return findRequest(collection.folders, collection.requests, requestId);
      },

      duplicateRequest: (collectionId: string, requestId: string) => {
        const state = get();
        const request = state.getRequest(collectionId, requestId);
        if (!request) return;

        const newRequest = createDefaultRequest({
          ...request,
          id: uuidv4(),
          name: `${request.name} (Copy)`,
        });

        set(s => {
          const collectionIndex = s.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;

          // Add to root level of collection for simplicity
          s.collections[collectionIndex].requests.push(newRequest);
        });
      },

      reorderRequests: (collectionId: string, folderId: string | null, fromIndex: number, toIndex: number) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;

          if (folderId === null) {
            // Reorder requests at collection root level
            const [removed] = state.collections[collectionIndex].requests.splice(fromIndex, 1);
            state.collections[collectionIndex].requests.splice(toIndex, 0, removed);
          } else {
            // Reorder requests within a folder
            const reorderInFolder = (folders: RequestFolder[]): RequestFolder[] => {
              return folders.map(f => {
                if (f.id === folderId) {
                  const newRequests = [...f.requests];
                  const [removed] = newRequests.splice(fromIndex, 1);
                  newRequests.splice(toIndex, 0, removed);
                  return { ...f, requests: newRequests };
                }
                return { ...f, folders: reorderInFolder(f.folders) };
              });
            };
            state.collections[collectionIndex].folders = reorderInFolder(
              state.collections[collectionIndex].folders
            );
          }
        });
      },

      moveRequest: (
        sourceCollectionId: string,
        _sourceFolderId: string | null,
        targetCollectionId: string,
        targetFolderId: string | null,
        requestId: string,
        targetIndex?: number
      ) => {
        const state = get();

        // Find the request first
        const sourceCollection = state.collections.find(c => c.id === sourceCollectionId);
        if (!sourceCollection) return;

        const request = findRequest(sourceCollection.folders, sourceCollection.requests, requestId);
        if (!request) return;

        set(s => {
          // Remove from source
          const sourceColIndex = s.collections.findIndex(c => c.id === sourceCollectionId);
          if (sourceColIndex === -1) return;

          const deleteResult = findAndDeleteRequest(
            s.collections[sourceColIndex].folders,
            s.collections[sourceColIndex].requests,
            requestId
          );

          if (deleteResult.found) {
            s.collections[sourceColIndex].folders = deleteResult.folders;
            s.collections[sourceColIndex].requests = deleteResult.requests;
          }

          // Add to target
          const targetColIndex = s.collections.findIndex(c => c.id === targetCollectionId);
          if (targetColIndex === -1) return;

          if (targetFolderId === null) {
            // Add to collection root
            if (targetIndex !== undefined) {
              s.collections[targetColIndex].requests.splice(targetIndex, 0, request);
            } else {
              s.collections[targetColIndex].requests.push(request);
            }
          } else {
            // Add to folder
            const addToFolder = (folders: RequestFolder[]): RequestFolder[] => {
              return folders.map(f => {
                if (f.id === targetFolderId) {
                  const newRequests = [...f.requests];
                  if (targetIndex !== undefined) {
                    newRequests.splice(targetIndex, 0, request);
                  } else {
                    newRequests.push(request);
                  }
                  return { ...f, requests: newRequests };
                }
                return { ...f, folders: addToFolder(f.folders) };
              });
            };
            s.collections[targetColIndex].folders = addToFolder(
              s.collections[targetColIndex].folders
            );
          }

          // Update any open tabs that reference this request
          s.tabs = s.tabs.map(t => {
            if (t.requestId === requestId) {
              return { ...t, collectionId: targetCollectionId, folderId: targetFolderId ?? undefined };
            }
            return t;
          });
        });
      },

      // Environments
      environments: [],
      activeEnvironmentId: null,

      addEnvironment: (name: string) => {
        const environment: Environment = {
          id: uuidv4(),
          name,
          variables: [],
        };
        set(state => {
          state.environments.push(environment);
        });
        return environment;
      },

      updateEnvironment: (id: string, updates: Partial<Environment>) => {
        set(state => {
          const index = state.environments.findIndex(e => e.id === id);
          if (index !== -1) {
            state.environments[index] = { ...state.environments[index], ...updates };
          }
        });
      },

      deleteEnvironment: (id: string) => {
        set(state => {
          state.environments = state.environments.filter(e => e.id !== id);
          if (state.activeEnvironmentId === id) {
            state.activeEnvironmentId = null;
          }
        });
      },

      setActiveEnvironment: (id: string | null) => {
        set(state => {
          state.activeEnvironmentId = id;
        });
      },

      getActiveEnvironment: () => {
        const state = get();
        if (!state.activeEnvironmentId) return null;
        return state.environments.find(e => e.id === state.activeEnvironmentId) || null;
      },

      duplicateEnvironment: (id: string) => {
        const state = get();
        const original = state.environments.find(e => e.id === id);
        if (!original) return null;

        const duplicated: Environment = {
          id: uuidv4(),
          name: `${original.name} (Copy)`,
          variables: original.variables.map(v => ({
            ...v,
            id: uuidv4(),
          })),
        };

        set(state => {
          state.environments.push(duplicated);
        });

        return duplicated;
      },

      importEnvironment: (environment: Environment) => {
        const imported: Environment = {
          ...environment,
          id: uuidv4(),
          variables: environment.variables.map(v => ({
            ...v,
            id: uuidv4(),
          })),
        };

        set(state => {
          state.environments.push(imported);
        });

        return imported;
      },

      // Tabs
      tabs: [],
      activeTabId: null,

      openTab: (tab: Omit<TabState, 'id'>) => {
        set(state => {
          // Check if tab already exists
          const existingTab = state.tabs.find(t =>
            t.requestId === tab.requestId && tab.requestId
          );

          if (existingTab) {
            state.activeTabId = existingTab.id;
          } else {
            const newTab: TabState = { ...tab, id: uuidv4() };
            state.tabs.push(newTab);
            state.activeTabId = newTab.id;
          }
        });
      },

      closeTab: (id: string) => {
        set(state => {
          const index = state.tabs.findIndex(t => t.id === id);
          state.tabs = state.tabs.filter(t => t.id !== id);

          if (state.activeTabId === id) {
            if (state.tabs.length > 0) {
              const newIndex = Math.min(index, state.tabs.length - 1);
              state.activeTabId = state.tabs[newIndex].id;
            } else {
              state.activeTabId = null;
            }
          }
        });
      },

      setActiveTab: (id: string) => {
        set(state => {
          state.activeTabId = id;
        });
      },

      updateTab: (id: string, updates: Partial<TabState>) => {
        set(state => {
          const index = state.tabs.findIndex(t => t.id === id);
          if (index !== -1) {
            state.tabs[index] = { ...state.tabs[index], ...updates };
          }
        });
      },

      // History
      history: [],

      addToHistory: (item: Omit<RequestHistoryItem, 'id' | 'timestamp'>) => {
        set(state => {
          const historyItem: RequestHistoryItem = {
            ...item,
            id: uuidv4(),
            timestamp: Date.now(),
          };
          state.history.unshift(historyItem);
          // Keep only last 100 items
          if (state.history.length > 100) {
            state.history = state.history.slice(0, 100);
          }
        });
      },

      clearHistory: () => {
        set(state => {
          state.history = [];
        });
      },

      // Active request
      activeRequest: null,

      setActiveRequest: (request: ApiRequest | null) => {
        set(state => {
          state.activeRequest = request;
        });
      },

      // Sidebar
      sidebarWidth: 280,
      sidebarCollapsed: false,

      setSidebarWidth: (width: number) => {
        set(state => {
          state.sidebarWidth = width;
        });
      },

      toggleSidebar: () => {
        set(state => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
        });
      },

      // Panel widths
      requestPanelWidth: 50, // percentage

      setRequestPanelWidth: (width: number) => {
        set(state => {
          state.requestPanelWidth = width;
        });
      },

      // Panel layout
      panelLayout: 'horizontal',

      setPanelLayout: (layout: 'horizontal' | 'vertical') => {
        set(state => {
          state.panelLayout = layout;
        });
      },

      togglePanelLayout: () => {
        set(state => {
          state.panelLayout = state.panelLayout === 'horizontal' ? 'vertical' : 'horizontal';
        });
      },

      // Import/Export
      importCollection: (collection: Collection) => {
        set(state => {
          // Ensure new IDs
          const newCollection: Collection = {
            ...collection,
            id: uuidv4(),
          };
          state.collections.push(newCollection);
        });
      },

      exportCollection: (id: string) => {
        const state = get();
        return state.collections.find(c => c.id === id) || null;
      },

      // Full app storage export/import
      exportFullStorage: () => {
        const state = get();
        return {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          collections: state.collections,
          environments: state.environments,
          activeEnvironmentId: state.activeEnvironmentId,
          history: state.history,
        };
      },

      importFullStorage: (data: AppStorageExport) => {
        set(state => {
          if (data.collections) {
            state.collections = data.collections;
          }
          if (data.environments) {
            state.environments = data.environments;
          }
          if (data.activeEnvironmentId !== undefined) {
            state.activeEnvironmentId = data.activeEnvironmentId;
          }
          if (data.history) {
            state.history = data.history;
          }
          // Close all tabs when importing full storage
          state.tabs = [];
          state.activeTabId = null;
          state.activeRequest = null;
        });
      },
    })),
    {
      name: 'fetchy-storage',
      storage: createJSONStorage(() => createCustomStorage()),
      partialize: (state) => ({
        collections: state.collections,
        environments: state.environments,
        activeEnvironmentId: state.activeEnvironmentId,
        history: state.history,
        sidebarWidth: state.sidebarWidth,
        sidebarCollapsed: state.sidebarCollapsed,
        requestPanelWidth: state.requestPanelWidth,
        panelLayout: state.panelLayout,
      }),
    }
  )
);

