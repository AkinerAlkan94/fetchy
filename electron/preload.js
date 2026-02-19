const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFile: (options) => ipcRenderer.invoke('open-file', options),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  readData: (filename) => ipcRenderer.invoke('read-data', filename),
  writeData: (data) => ipcRenderer.invoke('write-data', data),

  // Secrets storage (stored in secrets directory)
  readSecrets: () => ipcRenderer.invoke('read-secrets'),
  writeSecrets: (data) => ipcRenderer.invoke('write-secrets', data),

  // Preferences
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  savePreferences: (preferences) => ipcRenderer.invoke('save-preferences', preferences),

  // Legacy home directory (kept for backward compat)
  selectHomeDirectory: () => ipcRenderer.invoke('select-home-directory'),
  getHomeDirectory: () => ipcRenderer.invoke('get-home-directory'),
  migrateData: (data) => ipcRenderer.invoke('migrate-data', data),

  // Workspace management
  getWorkspaces: () => ipcRenderer.invoke('get-workspaces'),
  saveWorkspaces: (config) => ipcRenderer.invoke('save-workspaces', config),
  selectDirectory: (opts) => ipcRenderer.invoke('select-directory', opts),
  exportWorkspaceToJson: (data) => ipcRenderer.invoke('export-workspace-to-json', data),
  importWorkspaceFromJson: (data) => ipcRenderer.invoke('import-workspace-from-json', data),

  // HTTP request (bypasses CORS)
  httpRequest: (data) => ipcRenderer.invoke('http-request', data),
});
