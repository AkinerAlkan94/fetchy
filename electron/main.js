const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

let mainWindow;
let customHomeDirectory = null;
let customSecretsDirectory = null;

// ─── PREFERENCES ─────────────────────────────────────────────────────────────

function getPreferencesFilePath() {
  return path.join(app.getPath('userData'), 'preferences.json');
}

function loadPreferences() {
  try {
    const prefsPath = getPreferencesFilePath();
    if (fs.existsSync(prefsPath)) {
      const data = fs.readFileSync(prefsPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading preferences:', error);
  }
  return { homeDirectory: null, theme: 'dark', autoSave: true, maxHistoryItems: 100 };
}

function savePreferences(preferences) {
  try {
    const prefsPath = getPreferencesFilePath();
    fs.writeFileSync(prefsPath, JSON.stringify(preferences, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving preferences:', error);
    return false;
  }
}

// ─── WORKSPACES ───────────────────────────────────────────────────────────────

function getWorkspacesFilePath() {
  return path.join(app.getPath('userData'), 'workspaces.json');
}

function loadWorkspacesConfig() {
  try {
    const wPath = getWorkspacesFilePath();
    if (fs.existsSync(wPath)) {
      return JSON.parse(fs.readFileSync(wPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading workspaces config:', error);
  }
  return { workspaces: [], activeWorkspaceId: null };
}

function saveWorkspacesConfig(config) {
  try {
    fs.writeFileSync(getWorkspacesFilePath(), JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving workspaces config:', error);
    return false;
  }
}

// ─── DIRECTORIES ─────────────────────────────────────────────────────────────

function getEffectiveDataDirectory() {
  if (customHomeDirectory && fs.existsSync(customHomeDirectory)) {
    return customHomeDirectory;
  }
  return path.join(app.getPath('userData'), 'data');
}

function getEffectiveSecretsDirectory() {
  if (customSecretsDirectory) {
    return customSecretsDirectory;
  }
  // Fallback: .secrets inside the data directory
  return path.join(getEffectiveDataDirectory(), '.secrets');
}

// ─── INITIALIZATION ──────────────────────────────────────────────────────────

function initializeWorkspace() {
  const workspacesConfig = loadWorkspacesConfig();

  if (workspacesConfig.activeWorkspaceId && workspacesConfig.workspaces.length > 0) {
    const active = workspacesConfig.workspaces.find(
      (w) => w.id === workspacesConfig.activeWorkspaceId
    );
    if (active) {
      if (active.homeDirectory) {
        customHomeDirectory = active.homeDirectory;
      }
      if (active.secretsDirectory) {
        customSecretsDirectory = active.secretsDirectory;
      }
      return;
    }
  }

  // Fallback: legacy preferences.homeDirectory
  const prefs = loadPreferences();
  if (prefs.homeDirectory && fs.existsSync(prefs.homeDirectory)) {
    customHomeDirectory = prefs.homeDirectory;
  }
}

// ─── WINDOW ──────────────────────────────────────────────────────────────────

function createWindow() {
  initializeWorkspace();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    frame: true,
    backgroundColor: '#1a1a2e',
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// ─── IPC: FILE OPERATIONS ─────────────────────────────────────────────────────

ipcMain.handle('open-file', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [
      { name: 'All Files', extensions: ['*'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'YAML Files', extensions: ['yaml', 'yml'] },
    ],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { filePath, content };
  }
  return null;
});

ipcMain.handle('save-file', async (event, { content, defaultPath, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: filters || [{ name: 'JSON Files', extensions: ['json'] }],
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return result.filePath;
  }
  return null;
});

ipcMain.handle('get-data-path', () => {
  const dataPath = getEffectiveDataDirectory();
  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
  return dataPath;
});

ipcMain.handle('read-data', async (event, filename) => {
  try {
    const dataPath = path.join(getEffectiveDataDirectory(), filename);
    if (fs.existsSync(dataPath)) return fs.readFileSync(dataPath, 'utf-8');
    return null;
  } catch (error) {
    console.error('Error reading data:', error);
    return null;
  }
});

ipcMain.handle('write-data', async (event, { filename, content }) => {
  try {
    const dataDir = getEffectiveDataDirectory();
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, filename), content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing data:', error);
    return false;
  }
});

// ─── IPC: SECRETS ─────────────────────────────────────────────────────────────

ipcMain.handle('read-secrets', async () => {
  try {
    const secretsDir = getEffectiveSecretsDirectory();
    const secretsPath = path.join(secretsDir, 'fetchy-secrets.json');
    if (fs.existsSync(secretsPath)) return fs.readFileSync(secretsPath, 'utf-8');
    return null;
  } catch (error) {
    console.error('Error reading secrets:', error);
    return null;
  }
});

ipcMain.handle('write-secrets', async (event, { content }) => {
  try {
    const secretsDir = getEffectiveSecretsDirectory();
    if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir, { recursive: true });
    fs.writeFileSync(path.join(secretsDir, 'fetchy-secrets.json'), content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing secrets:', error);
    return false;
  }
});

// ─── IPC: PREFERENCES ─────────────────────────────────────────────────────────

ipcMain.handle('get-preferences', () => loadPreferences());

ipcMain.handle('save-preferences', async (event, preferences) => {
  const success = savePreferences(preferences);
  if (success && preferences.homeDirectory) {
    customHomeDirectory = preferences.homeDirectory;
  }
  return success;
});

// Legacy – still here for any existing consumers
ipcMain.handle('select-home-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Home Directory for Fetchy Data',
  });
  if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
  return null;
});

ipcMain.handle('get-home-directory', () => {
  return customHomeDirectory || path.join(app.getPath('userData'), 'data');
});

ipcMain.handle('migrate-data', async (event, { oldPath, newPath }) => {
  try {
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

// ─── IPC: WORKSPACE MANAGEMENT ───────────────────────────────────────────────

ipcMain.handle('get-workspaces', () => {
  return loadWorkspacesConfig();
});

ipcMain.handle('save-workspaces', (event, config) => {
  const success = saveWorkspacesConfig(config);
  // Hot-update active workspace dirs without reload (reload done by renderer)
  if (success && config.activeWorkspaceId) {
    const active = config.workspaces.find((w) => w.id === config.activeWorkspaceId);
    if (active) {
      customHomeDirectory = active.homeDirectory || null;
      customSecretsDirectory = active.secretsDirectory || null;
    }
  }
  return success;
});

ipcMain.handle('select-directory', async (event, { title } = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: title || 'Select Directory',
  });
  if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
  return null;
});

// Export a workspace's data (home + secrets) to a single JSON file via save dialog
ipcMain.handle('export-workspace-to-json', async (event, { workspaceId }) => {
  try {
    const config = loadWorkspacesConfig();
    const workspace = config.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return { success: false, error: 'Workspace not found' };

    // Read public data
    let publicData = null;
    const homeDataPath = path.join(workspace.homeDirectory, 'fetchy-storage.json');
    if (fs.existsSync(homeDataPath)) {
      publicData = JSON.parse(fs.readFileSync(homeDataPath, 'utf-8'));
    }

    // Read secrets
    let secretsData = null;
    const secretsFilePath = path.join(workspace.secretsDirectory, 'fetchy-secrets.json');
    if (fs.existsSync(secretsFilePath)) {
      secretsData = JSON.parse(fs.readFileSync(secretsFilePath, 'utf-8'));
    }

    const exportData = {
      fetchyWorkspaceExport: true,
      version: '2.0',
      exportedAt: new Date().toISOString(),
      workspaceName: workspace.name,
      publicData,
      secretsData,
    };

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

// Import a workspace from a JSON export file
ipcMain.handle('import-workspace-from-json', async (event, { name, homeDirectory, secretsDirectory, exportData }) => {
  try {
    if (!fs.existsSync(homeDirectory)) fs.mkdirSync(homeDirectory, { recursive: true });
    if (!fs.existsSync(secretsDirectory)) fs.mkdirSync(secretsDirectory, { recursive: true });

    if (exportData.publicData) {
      fs.writeFileSync(
        path.join(homeDirectory, 'fetchy-storage.json'),
        JSON.stringify(exportData.publicData, null, 2),
        'utf-8'
      );
    }

    if (exportData.secretsData) {
      fs.writeFileSync(
        path.join(secretsDirectory, 'fetchy-secrets.json'),
        JSON.stringify(exportData.secretsData, null, 2),
        'utf-8'
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

// ─── IPC: HTTP REQUEST ────────────────────────────────────────────────────────

ipcMain.handle('http-request', async (event, { url, method, headers, body }) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: headers || {},
        rejectUnauthorized: false,
      };

      const req = httpModule.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const endTime = Date.now();
          const responseBody = Buffer.concat(chunks).toString('utf-8');
          const responseHeaders = {};
          for (const [key, value] of Object.entries(res.headers)) {
            responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
          }
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: responseHeaders,
            body: responseBody,
            time: endTime - startTime,
            size: Buffer.byteLength(responseBody, 'utf-8'),
          });
        });
      });

      req.on('error', (error) => {
        const endTime = Date.now();
        let statusText = 'Network Error';
        if (error.code === 'ENOTFOUND') statusText = 'DNS Lookup Failed';
        else if (error.code === 'ECONNREFUSED') statusText = 'Connection Refused';
        else if (error.code === 'ECONNRESET') statusText = 'Connection Reset';
        else if (error.code === 'ETIMEDOUT') statusText = 'Connection Timed Out';
        else if (error.code === 'CERT_HAS_EXPIRED') statusText = 'Certificate Expired';
        else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') statusText = 'SSL Certificate Error';

        resolve({
          status: 0,
          statusText,
          headers: {},
          body: JSON.stringify({ error: error.message, code: error.code }),
          time: endTime - startTime,
          size: 0,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 0,
          statusText: 'Timeout',
          headers: {},
          body: JSON.stringify({ error: 'Request timed out' }),
          time: Date.now() - startTime,
          size: 0,
        });
      });

      req.setTimeout(30000);
      if (body) req.write(body);
      req.end();
    } catch (error) {
      resolve({
        status: 0,
        statusText: 'Error',
        headers: {},
        body: JSON.stringify({ error: error.message }),
        time: Date.now() - startTime,
        size: 0,
      });
    }
  });
});
