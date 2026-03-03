import { StateStorage } from 'zustand/middleware';
import { RequestHistoryItem, Collection, Environment, SecretsStorage } from '../types';

// Full storage export interface (legacy / v1 - kept for backward compatibility)
export interface AppStorageExport {
  version: string;
  exportedAt: string;
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  history?: RequestHistoryItem[];
}

// Check if running in Electron
export const isElectron =
  typeof window !== 'undefined' && !!(window as any).electronAPI;

// ---------------------------------------------------------------------------
// Git auto-sync (debounced)
// ---------------------------------------------------------------------------

let gitSyncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Trigger a debounced git auto-commit+push if the active workspace has
 * gitAutoSync enabled.  Called after every successful write to storage.
 * Skips sync when a merge is in progress to avoid committing half-resolved conflicts.
 */
function triggerGitAutoSync() {
  if (!isElectron) return;
  try {
    const { useWorkspacesStore } = require('./workspacesStore');
    const state = useWorkspacesStore.getState();
    const active = state.workspaces.find(
      (w: any) => w.id === state.activeWorkspaceId
    );
    if (!active?.gitAutoSync || !active.homeDirectory) return;

    if (gitSyncTimer) clearTimeout(gitSyncTimer);
    gitSyncTimer = setTimeout(async () => {
      try {
        const api = (window as any).electronAPI;
        if (!api?.gitAddCommitPush) return;

        // Do NOT auto-sync while a merge conflict is in progress
        if (api.gitIsMerging) {
          const mergeState = await api.gitIsMerging({ directory: active.homeDirectory });
          if (mergeState?.merging) {
            console.warn('Git auto-sync skipped: merge in progress');
            return;
          }
        }

        await api.gitAddCommitPush({
          directory: active.homeDirectory,
          message: `Fetchy auto-sync ${new Date().toISOString()}`,
        });
      } catch (e) {
        console.error('Git auto-sync failed:', e);
      }
    }, 3000);
  } catch {
    // workspacesStore not ready yet - ignore
  }
}

// ---------------------------------------------------------------------------
// Secrets helpers
// ---------------------------------------------------------------------------

/**
 * Extract secret variable values from state and return:
 *  - cleanState:  state with secret .value / .currentValue cleared
 *  - secretsMap:  map of "env:{envId}:{varId}" | "col:{colId}:{varId}" -> value
 */
function extractSecrets(stateWrapper: any): {
  cleanState: any;
  secretsMap: Record<string, string>;
} {
  const secretsMap: Record<string, string> = {};
  if (!stateWrapper?.state) return { cleanState: stateWrapper, secretsMap };

  const state = stateWrapper.state;
  const cleanStateInner = JSON.parse(JSON.stringify(state));

  // Environments
  if (Array.isArray(cleanStateInner.environments)) {
    for (const env of cleanStateInner.environments) {
      if (Array.isArray(env.variables)) {
        for (const variable of env.variables) {
          if (variable.isSecret) {
            const key = `env:${env.id}:${variable.id}`;
            secretsMap[key] = variable.currentValue || variable.value || variable.initialValue || '';
            variable.value = '';
            variable.currentValue = '';
            variable.initialValue = '';
          }
        }
      }
    }
  }

  // Collections
  if (Array.isArray(cleanStateInner.collections)) {
    for (const col of cleanStateInner.collections) {
      if (Array.isArray(col.variables)) {
        for (const variable of col.variables) {
          if (variable.isSecret) {
            const key = `col:${col.id}:${variable.id}`;
            secretsMap[key] = variable.currentValue || variable.value || variable.initialValue || '';
            variable.value = '';
            variable.currentValue = '';
            variable.initialValue = '';
          }
        }
      }
    }
  }

  return {
    cleanState: { ...stateWrapper, state: cleanStateInner },
    secretsMap,
  };
}

/**
 * Strip transient (script-set) environment variable values.
 */
function stripTransientEnvValues(stateWrapper: any): any {
  if (!stateWrapper?.state) return stateWrapper;
  const state = stateWrapper.state;

  if (Array.isArray(state.environments)) {
    for (const env of state.environments) {
      if (!Array.isArray(env.variables)) continue;
      env.variables = env.variables
        .filter((v: any) => !v._fromScript)
        .map((v: any) => {
          const { _fromScript, _scriptOverride, ...rest } = v;
          if (_scriptOverride) {
            const { currentValue, ...clean } = rest;
            return clean;
          }
          return rest;
        });
    }
  }

  return stateWrapper;
}

/**
 * Merge secrets back into state loaded from the home directory.
 */
function mergeSecrets(
  stateWrapper: any,
  secretsMap: Record<string, string>
): any {
  if (!stateWrapper?.state) return stateWrapper;

  const state = stateWrapper.state;

  if (Array.isArray(state.environments)) {
    for (const env of state.environments) {
      if (Array.isArray(env.variables)) {
        for (const variable of env.variables) {
          if (variable.isSecret) {
            const key = `env:${env.id}:${variable.id}`;
            if (secretsMap[key] !== undefined) {
              variable.value = secretsMap[key];
              variable.initialValue = secretsMap[key];
              variable.currentValue = secretsMap[key];
            }
          }
        }
      }
    }
  }

  if (Array.isArray(state.collections)) {
    for (const col of state.collections) {
      if (Array.isArray(col.variables)) {
        for (const variable of col.variables) {
          if (variable.isSecret) {
            const key = `col:${col.id}:${variable.id}`;
            if (secretsMap[key] !== undefined) {
              variable.value = secretsMap[key];
              variable.initialValue = secretsMap[key];
              variable.currentValue = secretsMap[key];
            }
          }
        }
      }
    }
  }

  return stateWrapper;
}

// ---------------------------------------------------------------------------
// Write-content cache to avoid unnecessary disk I/O
// ---------------------------------------------------------------------------
const writeContentCache: Record<string, string> = {};

async function writeIfChanged(api: any, filename: string, content: string) {
  if (writeContentCache[filename] === content) return;
  writeContentCache[filename] = content;
  await api.writeData({ filename, content });
}

/**
 * Invalidate the write-content cache so the next write is always applied.
 * Called after operations like git pull where files changed externally.
 */
export function invalidateWriteCache() {
  for (const key of Object.keys(writeContentCache)) {
    delete writeContentCache[key];
  }
}

// ---------------------------------------------------------------------------
// Migration: single-file -> split-file format
// ---------------------------------------------------------------------------

async function migrateToSplitStorage(api: any, oldDataRaw: string) {
  try {
    const oldData = JSON.parse(oldDataRaw);
    const state = oldData.state || oldData;

    const meta = {
      activeEnvironmentId: state.activeEnvironmentId ?? null,
      sidebarWidth: state.sidebarWidth ?? 280,
      sidebarCollapsed: state.sidebarCollapsed ?? false,
      requestPanelWidth: state.requestPanelWidth ?? 50,
      panelLayout: state.panelLayout ?? 'horizontal',
    };
    await api.writeData({ filename: 'meta.json', content: JSON.stringify(meta, null, 2) });

    if (Array.isArray(state.collections)) {
      for (const col of state.collections) {
        await api.writeData({
          filename: `collections/${col.id}.json`,
          content: JSON.stringify(col, null, 2),
        });
      }
    }

    if (Array.isArray(state.environments)) {
      for (const env of state.environments) {
        await api.writeData({
          filename: `environments/${env.id}.json`,
          content: JSON.stringify(env, null, 2),
        });
      }
    }

    if (Array.isArray(state.history)) {
      await api.writeData({
        filename: 'history.json',
        content: JSON.stringify(state.history, null, 2),
      });
    }

    if (Array.isArray(state.openApiDocuments)) {
      for (const doc of state.openApiDocuments) {
        await api.writeData({
          filename: `openapi-docs/${doc.id}.json`,
          content: JSON.stringify(doc, null, 2),
        });
      }
    }

    // Remove the old single file so migration doesn't run again
    await api.deleteDataFile('fetchy-storage.json');

    console.log('Successfully migrated from single-file to split-file storage.');
  } catch (error) {
    console.error('Migration from single file failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Custom storage factory (split-file for Electron, localStorage fallback)
// ---------------------------------------------------------------------------

export const createCustomStorage = (): StateStorage => {
  if (isElectron) {
    return {
      getItem: async (_name: string): Promise<string | null> => {
        try {
          const api = (window as any).electronAPI;

          // Check for old single-file format and migrate
          const oldData = await api.readData('fetchy-storage.json');
          if (oldData) {
            await migrateToSplitStorage(api, oldData);
          }

          // Read split files
          const metaRaw = await api.readData('meta.json');
          if (!metaRaw && !oldData) return null;

          let meta: any = {};
          if (metaRaw) {
            try { meta = JSON.parse(metaRaw); } catch {}
          }

          // Collections
          const collectionFiles: string[] = await api.listDataDir('collections');
          const collections: any[] = [];
          for (const file of collectionFiles) {
            const content = await api.readData(`collections/${file}`);
            if (content) {
              try { collections.push(JSON.parse(content)); } catch {
                console.warn(`Skipping corrupt collection file: ${file}`);
              }
            }
          }

          // Environments
          const envFiles: string[] = await api.listDataDir('environments');
          const environments: any[] = [];
          for (const file of envFiles) {
            const content = await api.readData(`environments/${file}`);
            if (content) {
              try { environments.push(JSON.parse(content)); } catch {
                console.warn(`Skipping corrupt environment file: ${file}`);
              }
            }
          }

          // History
          let history: any[] = [];
          const historyRaw = await api.readData('history.json');
          if (historyRaw) {
            try { history = JSON.parse(historyRaw); } catch {}
          }

          // OpenAPI documents
          const openapiFiles: string[] = await api.listDataDir('openapi-docs');
          const openApiDocuments: any[] = [];
          for (const file of openapiFiles) {
            const content = await api.readData(`openapi-docs/${file}`);
            if (content) {
              try { openApiDocuments.push(JSON.parse(content)); } catch {
                console.warn(`Skipping corrupt OpenAPI doc file: ${file}`);
              }
            }
          }

          // Assemble state
          const state = {
            collections,
            environments,
            activeEnvironmentId: meta.activeEnvironmentId ?? null,
            history,
            sidebarWidth: meta.sidebarWidth ?? 280,
            sidebarCollapsed: meta.sidebarCollapsed ?? false,
            requestPanelWidth: meta.requestPanelWidth ?? 50,
            panelLayout: meta.panelLayout ?? 'horizontal',
            openApiDocuments,
          };

          let stateWrapper = { state, version: 0 };

          // Merge secrets from secrets directory
          try {
            const secretsRaw = await api.readSecrets();
            if (secretsRaw) {
              const secretsStorage: SecretsStorage = JSON.parse(secretsRaw);
              if (secretsStorage?.secrets) {
                stateWrapper = mergeSecrets(stateWrapper, secretsStorage.secrets);
              }
            }
          } catch {
            // secrets file missing or corrupt - not fatal
          }

          stateWrapper = stripTransientEnvValues(stateWrapper);
          return JSON.stringify(stateWrapper);
        } catch (error) {
          console.error('Error reading from split file storage:', error);
          return null;
        }
      },

      setItem: async (_name: string, value: string): Promise<void> => {
        try {
          const api = (window as any).electronAPI;
          const stateWrapper = JSON.parse(value);

          // Trim large response bodies from history
          if (stateWrapper?.state?.history) {
            const MAX_BODY_SIZE = 5_000;
            stateWrapper.state.history = stateWrapper.state.history.map(
              (item: any) => {
                if (item?.response?.body && item.response.body.length > MAX_BODY_SIZE) {
                  return {
                    ...item,
                    response: {
                      ...item.response,
                      body: item.response.body.slice(0, MAX_BODY_SIZE) + '\n... [truncated for storage]',
                    },
                  };
                }
                return item;
              }
            );
          }

          stripTransientEnvValues(stateWrapper);
          const { cleanState, secretsMap } = extractSecrets(stateWrapper);
          const state = cleanState.state;

          // Write meta.json
          const meta = {
            activeEnvironmentId: state.activeEnvironmentId,
            sidebarWidth: state.sidebarWidth,
            sidebarCollapsed: state.sidebarCollapsed,
            requestPanelWidth: state.requestPanelWidth,
            panelLayout: state.panelLayout,
          };
          await writeIfChanged(api, 'meta.json', JSON.stringify(meta, null, 2));

          // Write individual collections
          if (Array.isArray(state.collections)) {
            const currentIds = new Set<string>();
            for (const col of state.collections) {
              currentIds.add(col.id);
              await writeIfChanged(api, `collections/${col.id}.json`, JSON.stringify(col, null, 2));
            }
            try {
              const existingFiles: string[] = await api.listDataDir('collections');
              for (const file of existingFiles) {
                const id = file.replace('.json', '');
                if (!currentIds.has(id)) {
                  await api.deleteDataFile(`collections/${file}`);
                  delete writeContentCache[`collections/${file}`];
                }
              }
            } catch {}
          }

          // Write individual environments
          if (Array.isArray(state.environments)) {
            const currentIds = new Set<string>();
            for (const env of state.environments) {
              currentIds.add(env.id);
              await writeIfChanged(api, `environments/${env.id}.json`, JSON.stringify(env, null, 2));
            }
            try {
              const existingFiles: string[] = await api.listDataDir('environments');
              for (const file of existingFiles) {
                const id = file.replace('.json', '');
                if (!currentIds.has(id)) {
                  await api.deleteDataFile(`environments/${file}`);
                  delete writeContentCache[`environments/${file}`];
                }
              }
            } catch {}
          }

          // Write history
          if (Array.isArray(state.history)) {
            await writeIfChanged(api, 'history.json', JSON.stringify(state.history, null, 2));
          }

          // Write individual OpenAPI documents
          if (Array.isArray(state.openApiDocuments)) {
            const currentIds = new Set<string>();
            for (const doc of state.openApiDocuments) {
              currentIds.add(doc.id);
              await writeIfChanged(api, `openapi-docs/${doc.id}.json`, JSON.stringify(doc, null, 2));
            }
            try {
              const existingFiles: string[] = await api.listDataDir('openapi-docs');
              for (const file of existingFiles) {
                const id = file.replace('.json', '');
                if (!currentIds.has(id)) {
                  await api.deleteDataFile(`openapi-docs/${file}`);
                  delete writeContentCache[`openapi-docs/${file}`];
                }
              }
            } catch {}
          }

          // Write secrets
          const secretsStorage: SecretsStorage = {
            version: '1.0',
            secrets: secretsMap,
          };
          await api.writeSecrets({
            content: JSON.stringify(secretsStorage, null, 2),
          });

          // Trigger git auto-sync
          triggerGitAutoSync();
        } catch (error) {
          console.error('Error writing to split file storage:', error);
        }
      },

      removeItem: async (_name: string): Promise<void> => {
        try {
          const api = (window as any).electronAPI;
          await api.deleteDataFile('meta.json');
          await api.deleteDataFile('history.json');
          for (const dir of ['collections', 'environments', 'openapi-docs']) {
            try {
              const files: string[] = await api.listDataDir(dir);
              for (const file of files) {
                await api.deleteDataFile(`${dir}/${file}`);
              }
            } catch {}
          }
        } catch (error) {
          console.error('Error removing from file storage:', error);
        }
      },
    };
  }

  // -- Browser / localStorage fallback ----------------------------------------
  return {
    getItem: (name: string): string | null => {
      const raw = localStorage.getItem(name);
      if (!raw) return null;

      try {
        let stateWrapper = JSON.parse(raw);
        const secretsRaw = localStorage.getItem(`${name}-secrets`);
        if (secretsRaw) {
          const secretsStorage: SecretsStorage = JSON.parse(secretsRaw);
          if (secretsStorage?.secrets) {
            stateWrapper = mergeSecrets(stateWrapper, secretsStorage.secrets);
          }
        }
        stateWrapper = stripTransientEnvValues(stateWrapper);
        return JSON.stringify(stateWrapper);
      } catch {
        return raw;
      }
    },

    setItem: (name: string, value: string): void => {
      try {
        const stateWrapper = JSON.parse(value);

        if (stateWrapper?.state?.history) {
          const MAX_BODY_SIZE = 5_000;
          stateWrapper.state.history = stateWrapper.state.history.map(
            (item: any) => {
              if (item?.response?.body && item.response.body.length > MAX_BODY_SIZE) {
                return {
                  ...item,
                  response: {
                    ...item.response,
                    body: item.response.body.slice(0, MAX_BODY_SIZE) + '\n... [truncated for storage]',
                  },
                };
              }
              return item;
            }
          );
        }

        stripTransientEnvValues(stateWrapper);
        const { cleanState, secretsMap } = extractSecrets(stateWrapper);
        localStorage.setItem(name, JSON.stringify(cleanState));
        const secretsStorage: SecretsStorage = { version: '1.0', secrets: secretsMap };
        localStorage.setItem(`${name}-secrets`, JSON.stringify(secretsStorage));
      } catch (error) {
        console.error('Error persisting to localStorage:', error);
      }
    },

    removeItem: (name: string): void => {
      localStorage.removeItem(name);
      localStorage.removeItem(`${name}-secrets`);
    },
  };
};
