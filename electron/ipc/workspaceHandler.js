/**
 * IPC handlers for preferences and workspace management.
 * Handles: get-preferences, save-preferences, select-home-directory,
 *          get-home-directory, migrate-data, get-workspaces, save-workspaces,
 *          select-directory, export-workspace-to-json, import-workspace-from-json
 *
 * @module electron/ipc/workspaceHandler
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { requireObject, requireString, requireDirectoryPath, optionalString } = require('./validate');

/**
 * Read all split storage files from a workspace home directory and assemble
 * into a single state object. Supports both old single-file format (migration)
 * and new split-file format.
 */
function readSplitStorageSync(homeDir) {
  const result = { collections: [], environments: [], openApiDocuments: [], history: [], meta: {} };

  // Check for old single-file format
  const oldPath = path.join(homeDir, 'fetchy-storage.json');
  if (fs.existsSync(oldPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
      const state = raw.state || raw;
      result.collections = state.collections || [];
      result.environments = state.environments || [];
      result.openApiDocuments = state.openApiDocuments || [];
      result.history = state.history || [];
      result.meta = {
        activeEnvironmentId: state.activeEnvironmentId ?? null,
        sidebarWidth: state.sidebarWidth ?? 280,
        sidebarCollapsed: state.sidebarCollapsed ?? false,
        requestPanelWidth: state.requestPanelWidth ?? 50,
        panelLayout: state.panelLayout ?? 'horizontal',
      };
      return result;
    } catch { /* fall through to split format */ }
  }

  // Read split format
  const metaPath = path.join(homeDir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    try { result.meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch {}
  }

  const collectionsDir = path.join(homeDir, 'collections');
  if (fs.existsSync(collectionsDir)) {
    for (const f of fs.readdirSync(collectionsDir).filter(f => f.endsWith('.json'))) {
      try { result.collections.push(JSON.parse(fs.readFileSync(path.join(collectionsDir, f), 'utf-8'))); } catch {}
    }
  }

  const envsDir = path.join(homeDir, 'environments');
  if (fs.existsSync(envsDir)) {
    for (const f of fs.readdirSync(envsDir).filter(f => f.endsWith('.json'))) {
      try { result.environments.push(JSON.parse(fs.readFileSync(path.join(envsDir, f), 'utf-8'))); } catch {}
    }
  }

  const historyPath = path.join(homeDir, 'history.json');
  if (fs.existsSync(historyPath)) {
    try { result.history = JSON.parse(fs.readFileSync(historyPath, 'utf-8')); } catch {}
  }

  const openapiDir = path.join(homeDir, 'openapi-docs');
  if (fs.existsSync(openapiDir)) {
    for (const f of fs.readdirSync(openapiDir).filter(f => f.endsWith('.json'))) {
      try { result.openApiDocuments.push(JSON.parse(fs.readFileSync(path.join(openapiDir, f), 'utf-8'))); } catch {}
    }
  }

  return result;
}

/**
 * Register workspace and preference IPC handlers.
 *
 * @param {Electron.IpcMain} ipcMain
 * @param {object} deps
 * @param {function} deps.getMainWindow
 * @param {function} deps.getEffectiveDataDirectory
 * @param {function} deps.getEffectiveSecretsDirectory
 * @param {function} deps.getCustomHomeDirectory
 * @param {function} deps.setCustomHomeDirectory
 * @param {function} deps.setCustomSecretsDirectory
 * @param {function} deps.loadPreferences
 * @param {function} deps.savePreferences
 * @param {function} deps.loadWorkspacesConfig
 * @param {function} deps.saveWorkspacesConfig
 * @param {function} deps.safeWriteFileSync
 * @param {function} deps.readEncryptedSecrets
 * @param {function} deps.writeEncryptedSecrets
 * @param {function} deps.startStorageWatcher
 * @param {function} deps.stopStorageWatcher
 * @param {Electron.Dialog} deps.dialog
 * @param {function} deps.getAppPath - app.getPath bound function
 */
function register(ipcMain, deps) {
  const {
    getMainWindow,
    getEffectiveDataDirectory,
    getEffectiveSecretsDirectory,
    getCustomHomeDirectory,
    setCustomHomeDirectory,
    setCustomSecretsDirectory,
    loadPreferences,
    savePreferences,
    loadWorkspacesConfig,
    saveWorkspacesConfig,
    safeWriteFileSync,
    readEncryptedSecrets,
    writeEncryptedSecrets,
    startStorageWatcher,
    stopStorageWatcher,
    dialog,
    getAppPath,
  } = deps;

  // ─── Preferences ───────────────────────────────────────────────────────────

  ipcMain.handle('get-preferences', () => loadPreferences());

  ipcMain.handle('save-preferences', async (event, preferences) => {
    requireObject(preferences, 'preferences');
    const success = savePreferences(preferences);
    if (success && preferences.homeDirectory) {
      setCustomHomeDirectory(preferences.homeDirectory);
    }
    return success;
  });

  // Legacy – still here for any existing consumers
  ipcMain.handle('select-home-directory', async () => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Home Directory for Fetchy Data',
    });
    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
    return null;
  });

  ipcMain.handle('get-home-directory', () => {
    return getCustomHomeDirectory() || path.join(getAppPath('userData'), 'data');
  });

  ipcMain.handle('migrate-data', async (event, data) => {
    try {
      requireObject(data, 'migrate data');
      const oldPath = requireDirectoryPath(data.oldPath, 'oldPath');
      const newPath = requireDirectoryPath(data.newPath, 'newPath');
      if (!fs.existsSync(newPath)) fs.mkdirSync(newPath, { recursive: true });
      if (fs.existsSync(oldPath)) {
        const files = fs.readdirSync(oldPath);
        for (const file of files) {
          const srcPath = path.join(oldPath, file);
          const destPath = path.join(newPath, file);
          if (fs.statSync(srcPath).isFile()) fs.copyFileSync(srcPath, destPath);
        }
      }
      return true;
    } catch (error) {
      console.error('Error migrating data:', error);
      return false;
    }
  });

  // ─── Workspace management ──────────────────────────────────────────────────

  ipcMain.handle('get-workspaces', () => {
    return loadWorkspacesConfig();
  });

  ipcMain.handle('save-workspaces', (event, config) => {
    requireObject(config, 'workspace config');
    if (!Array.isArray(config.workspaces)) {
      throw new Error('workspaces must be an array');
    }
    const success = saveWorkspacesConfig(config);
    if (success && config.activeWorkspaceId) {
      const active = config.workspaces.find((w) => w.id === config.activeWorkspaceId);
      if (active) {
        setCustomHomeDirectory(active.homeDirectory || null);
        setCustomSecretsDirectory(active.secretsDirectory || null);
        // Restart watcher for the new active workspace directory
        if (active.homeDirectory) {
          startStorageWatcher(active.homeDirectory);
        } else {
          stopStorageWatcher();
        }
      }
    }
    return success;
  });

  ipcMain.handle('select-directory', async (event, { title } = {}) => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: title || 'Select Directory',
    });
    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
    return null;
  });

  // ─── Export / Import workspace ─────────────────────────────────────────────

  ipcMain.handle('export-workspace-to-json', async (event, data) => {
    try {
      requireObject(data, 'export data');
      const workspaceId = requireString(data.workspaceId, 'workspaceId', 200);
      const config = loadWorkspacesConfig();
      const workspace = config.workspaces.find((w) => w.id === workspaceId);
      if (!workspace) return { success: false, error: 'Workspace not found' };

      const storageData = readSplitStorageSync(workspace.homeDirectory);
      const publicData = {
        state: {
          collections: storageData.collections,
          environments: storageData.environments,
          activeEnvironmentId: storageData.meta.activeEnvironmentId ?? null,
          history: storageData.history,
          sidebarWidth: storageData.meta.sidebarWidth ?? 280,
          sidebarCollapsed: storageData.meta.sidebarCollapsed ?? false,
          requestPanelWidth: storageData.meta.requestPanelWidth ?? 50,
          panelLayout: storageData.meta.panelLayout ?? 'horizontal',
          openApiDocuments: storageData.openApiDocuments,
        },
        version: 0,
      };

      let secretsData = null;
      const secretsRaw = readEncryptedSecrets(workspace.secretsDirectory, 'fetchy-secrets');
      if (secretsRaw) secretsData = JSON.parse(secretsRaw);

      const exportData = {
        fetchyWorkspaceExport: true,
        version: '2.0',
        exportedAt: new Date().toISOString(),
        workspaceName: workspace.name,
        publicData,
        secretsData,
      };

      const mainWindow = getMainWindow();
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `fetchy-workspace-${workspace.name.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        title: 'Export Workspace',
      });

      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8');
        return { success: true, filePath: result.filePath };
      }
      return { success: false, error: 'Cancelled' };
    } catch (error) {
      console.error('Error exporting workspace:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('import-workspace-from-json', async (event, data) => {
    try {
      requireObject(data, 'import data');
      const name = requireString(data.name, 'name', 500);
      const homeDirectory = requireDirectoryPath(data.homeDirectory, 'homeDirectory');
      const secretsDirectory = requireDirectoryPath(data.secretsDirectory, 'secretsDirectory');
      requireObject(data.exportData, 'exportData');
      const exportData = data.exportData;

      if (!fs.existsSync(homeDirectory)) fs.mkdirSync(homeDirectory, { recursive: true });
      if (!fs.existsSync(secretsDirectory)) fs.mkdirSync(secretsDirectory, { recursive: true });

      if (exportData.publicData) {
        const state = exportData.publicData.state || exportData.publicData;

        // Write meta.json
        const meta = {
          activeEnvironmentId: state.activeEnvironmentId ?? null,
          sidebarWidth: state.sidebarWidth ?? 280,
          sidebarCollapsed: state.sidebarCollapsed ?? false,
          requestPanelWidth: state.requestPanelWidth ?? 50,
          panelLayout: state.panelLayout ?? 'horizontal',
        };
        safeWriteFileSync(path.join(homeDirectory, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

        // Write collections
        if (Array.isArray(state.collections)) {
          const colDir = path.join(homeDirectory, 'collections');
          if (!fs.existsSync(colDir)) fs.mkdirSync(colDir, { recursive: true });
          for (const col of state.collections) {
            safeWriteFileSync(path.join(colDir, `${col.id}.json`), JSON.stringify(col, null, 2), 'utf-8');
          }
        }

        // Write environments
        if (Array.isArray(state.environments)) {
          const envDir = path.join(homeDirectory, 'environments');
          if (!fs.existsSync(envDir)) fs.mkdirSync(envDir, { recursive: true });
          for (const env of state.environments) {
            safeWriteFileSync(path.join(envDir, `${env.id}.json`), JSON.stringify(env, null, 2), 'utf-8');
          }
        }

        // Write history
        if (Array.isArray(state.history)) {
          safeWriteFileSync(path.join(homeDirectory, 'history.json'), JSON.stringify(state.history, null, 2), 'utf-8');
        }

        // Write openapi docs
        if (Array.isArray(state.openApiDocuments)) {
          const docDir = path.join(homeDirectory, 'openapi-docs');
          if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });
          for (const doc of state.openApiDocuments) {
            safeWriteFileSync(path.join(docDir, `${doc.id}.json`), JSON.stringify(doc, null, 2), 'utf-8');
          }
        }
      }

      if (exportData.secretsData) {
        writeEncryptedSecrets(
          secretsDirectory,
          'fetchy-secrets',
          JSON.stringify(exportData.secretsData, null, 2)
        );
      }

      const newWorkspace = {
        id: crypto.randomUUID(),
        name,
        homeDirectory,
        secretsDirectory,
        createdAt: Date.now(),
      };

      const config = loadWorkspacesConfig();
      config.workspaces.push(newWorkspace);
      saveWorkspacesConfig(config);

      return { success: true, workspace: newWorkspace };
    } catch (error) {
      console.error('Error importing workspace:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { register, readSplitStorageSync };
