import { useState, useEffect, useRef } from 'react';
import { X, FolderOpen, RefreshCw, Check, AlertCircle, Download, Upload, AlertTriangle } from 'lucide-react';
import { usePreferencesStore } from '../store/preferencesStore';
import { useAppStore, AppStorageExport } from '../store/appStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { preferences, isElectron, savePreferences, selectHomeDirectory, setHomeDirectory, getHomeDirectory } = usePreferencesStore();
  const { exportFullStorage, importFullStorage, panelLayout, setPanelLayout } = useAppStore();

  const [currentHomeDir, setCurrentHomeDir] = useState<string>('');
  const [newHomeDir, setNewHomeDir] = useState<string>('');
  const [migrateData, setMigrateData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Data backup/restore state
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<AppStorageExport | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadCurrentHomeDir();
    }
  }, [isOpen]);

  const loadCurrentHomeDir = async () => {
    const dir = await getHomeDirectory();
    setCurrentHomeDir(dir);
    setNewHomeDir(dir);
  };

  const handleSelectDirectory = async () => {
    const selected = await selectHomeDirectory();
    if (selected) {
      setNewHomeDir(selected);
    }
  };

  const handleSaveHomeDirectory = async () => {
    if (!newHomeDir || newHomeDir === currentHomeDir) {
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      const success = await setHomeDirectory(newHomeDir, migrateData);

      if (success) {
        setSaveStatus('success');
        setCurrentHomeDir(newHomeDir);

        // Reload the page to reinitialize stores with new home directory
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setSaveStatus('error');
        setErrorMessage('Failed to set home directory. Please check permissions.');
      }
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportStorage = () => {
    const data = exportFullStorage();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fetchy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as AppStorageExport;

        // Validate the imported data structure
        if (!data.collections && !data.environments && !data.history) {
          setImportStatus('error');
          setImportMessage('Invalid backup file: missing required data fields');
          return;
        }

        setPendingImportData(data);
        setShowImportConfirm(true);
        setImportStatus('idle');
        setImportMessage('');
      } catch {
        setImportStatus('error');
        setImportMessage('Invalid JSON file');
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!pendingImportData) return;

    try {
      importFullStorage(pendingImportData);
      setImportStatus('success');
      setImportMessage('Data imported successfully. The application will reload.');
      setShowImportConfirm(false);
      setPendingImportData(null);

      // Reload after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch {
      setImportStatus('error');
      setImportMessage('Failed to import data');
    }
  };

  const handleCancelImport = () => {
    setShowImportConfirm(false);
    setPendingImportData(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a2e] rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-hidden border border-[#2d2d44]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2d2d44]">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {/* Home Directory Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white uppercase tracking-wider">
              Data Storage Location
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Current Home Directory
                </label>
                <div className="flex items-center gap-2 p-3 bg-[#0f0f1a] rounded border border-[#2d2d44]">
                  <FolderOpen size={16} className="text-gray-500" />
                  <span className="text-gray-300 text-sm font-mono truncate flex-1">
                    {currentHomeDir || 'Not set (using default)'}
                  </span>
                </div>
              </div>

              {isElectron && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      New Home Directory
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newHomeDir}
                        onChange={(e) => setNewHomeDir(e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm font-mono focus:outline-none focus:border-purple-500"
                        placeholder="Enter path or browse..."
                      />
                      <button
                        onClick={handleSelectDirectory}
                        className="px-3 py-2 bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] transition-colors"
                        title="Browse..."
                      >
                        <FolderOpen size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="migrateData"
                      checked={migrateData}
                      onChange={(e) => setMigrateData(e.target.checked)}
                      className="w-4 h-4 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-500 focus:ring-purple-500"
                    />
                    <label htmlFor="migrateData" className="text-sm text-gray-300">
                      Migrate existing data to new location
                    </label>
                  </div>

                  <button
                    onClick={handleSaveHomeDirectory}
                    disabled={isSaving || !newHomeDir || newHomeDir === currentHomeDir}
                    className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                      isSaving || !newHomeDir || newHomeDir === currentHomeDir
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Apply Home Directory
                      </>
                    )}
                  </button>

                  {saveStatus === 'success' && (
                    <div className="flex items-center gap-2 text-green-400 text-sm">
                      <Check size={16} />
                      Home directory updated. Reloading...
                    </div>
                  )}

                  {saveStatus === 'error' && (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertCircle size={16} />
                      {errorMessage || 'Failed to update home directory'}
                    </div>
                  )}
                </>
              )}

              {!isElectron && (
                <div className="text-sm text-gray-500 italic">
                  Home directory selection is only available in the desktop app.
                  Data is stored in browser localStorage.
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500">
              All collections, environments, and request history will be stored in this directory.
              Changing the home directory will require restarting the application.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-[#2d2d44]" />

          {/* Other Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white uppercase tracking-wider">
              General Settings
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-gray-300">Auto-save</label>
                  <p className="text-xs text-gray-500">Automatically save changes to collections</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.autoSave}
                  onChange={(e) => savePreferences({ autoSave: e.target.checked })}
                  className="w-4 h-4 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-500 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-gray-300">Max History Items</label>
                  <p className="text-xs text-gray-500">Number of request history items to keep</p>
                </div>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={preferences.maxHistoryItems}
                  onChange={(e) => savePreferences({ maxHistoryItems: parseInt(e.target.value) || 100 })}
                  className="w-20 px-2 py-1 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-gray-300">Panel Layout</label>
                  <p className="text-xs text-gray-500">Position of response panel relative to request</p>
                </div>
                <select
                  value={panelLayout}
                  onChange={(e) => setPanelLayout(e.target.value as 'horizontal' | 'vertical')}
                  className="px-3 py-1 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="horizontal">Right</option>
                  <option value="vertical">Down</option>
                </select>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#2d2d44]" />

          {/* Data Backup/Restore Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white uppercase tracking-wider">
              Data Backup & Restore
            </h3>

            <p className="text-xs text-gray-500">
              Export all your collections, environments, and request history as a single JSON file,
              or restore from a previously exported backup.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportStorage}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                <Download size={16} />
                Export All Data
              </button>

              <button
                onClick={handleImportClick}
                className="flex items-center gap-2 px-4 py-2 bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] transition-colors"
              >
                <Upload size={16} />
                Import Backup
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {importStatus === 'success' && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <Check size={16} />
                {importMessage}
              </div>
            )}

            {importStatus === 'error' && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle size={16} />
                {importMessage}
              </div>
            )}
          </div>
        </div>

        {/* Import Confirmation Modal */}
        {showImportConfirm && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10 rounded-lg">
            <div className="bg-[#1a1a2e] rounded-lg shadow-xl w-[450px] border border-[#2d2d44] p-6 m-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-yellow-500/20 rounded-full">
                  <AlertTriangle size={24} className="text-yellow-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Confirm Import
                  </h3>
                  <p className="text-sm text-gray-300 mb-4">
                    This will <span className="text-yellow-400 font-semibold">overwrite all your existing data</span>, including:
                  </p>
                  <ul className="text-sm text-gray-400 list-disc list-inside mb-4 space-y-1">
                    <li>All collections and requests</li>
                    <li>All environments and variables</li>
                    <li>Request history</li>
                  </ul>
                  {pendingImportData && (
                    <div className="text-xs text-gray-500 bg-[#0f0f1a] p-3 rounded mb-4">
                      <div>Backup date: {new Date(pendingImportData.exportedAt).toLocaleString()}</div>
                      <div>Collections: {pendingImportData.collections?.length || 0}</div>
                      <div>Environments: {pendingImportData.environments?.length || 0}</div>
                      <div>History items: {pendingImportData.history?.length || 0}</div>
                    </div>
                  )}
                  <p className="text-sm text-gray-400">
                    This action cannot be undone. Are you sure you want to continue?
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleCancelImport}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                >
                  Yes, Import and Overwrite
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-[#2d2d44]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

