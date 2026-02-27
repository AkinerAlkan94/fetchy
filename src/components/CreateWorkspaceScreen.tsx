import { useState } from 'react';
import { FolderOpen, Lock, Layers, RefreshCw, Upload, GitBranch, Download, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useWorkspacesStore } from '../store/workspacesStore';

interface CreateWorkspaceScreenProps {
  /** Called after a workspace is successfully created / activated */
  onCreated: () => void;
}

interface FormState {
  name: string;
  homeDirectory: string;
  secretsDirectory: string;
}

type CreationMode = 'manual' | 'git';
type GitCloneStatus = 'idle' | 'cloning' | 'success' | 'error';

const emptyForm: FormState = { name: '', homeDirectory: '', secretsDirectory: '' };

export default function CreateWorkspaceScreen({ onCreated }: CreateWorkspaceScreenProps) {
  const { isElectron, addWorkspace, importWorkspaceFromFile } = useWorkspacesStore();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Git clone state
  const [mode, setMode] = useState<CreationMode>('manual');
  const [gitUrl, setGitUrl] = useState('');
  const [gitDirectory, setGitDirectory] = useState('');
  const [gitCloneStatus, setGitCloneStatus] = useState<GitCloneStatus>('idle');
  const [gitCloneMessage, setGitCloneMessage] = useState('');
  const [gitAvailable, setGitAvailable] = useState<boolean | null>(null);

  // Check git availability when switching to git mode
  const checkGit = async () => {
    if (!isElectron || !window.electronAPI?.gitCheck) {
      setGitAvailable(false);
      return;
    }
    const result = await window.electronAPI.gitCheck();
    setGitAvailable(result.available);
  };

  const pickDirectory = async (field: 'homeDirectory' | 'secretsDirectory') => {
    if (!isElectron || !window.electronAPI) return;
    const titles: Record<typeof field, string> = {
      homeDirectory: 'Select Home Directory (collections, environments, APIs)',
      secretsDirectory: 'Select Secrets Directory (secret variable values)',
    };
    const dir = await window.electronAPI.selectDirectory({ title: titles[field] });
    if (dir) setForm((p) => ({ ...p, [field]: dir }));
  };

  const handleCreate = async () => {
    const name = form.name.trim();
    if (!name) {
      setError('Please enter a workspace name.');
      return;
    }
    if (isElectron && (!form.homeDirectory || !form.secretsDirectory)) {
      setError('Please select both directories.');
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      // In browser mode directories are virtual � use a namespaced placeholder.
      const home = form.homeDirectory || ('browser:' + name + ':home');
      const secrets = form.secretsDirectory || ('browser:' + name + ':secrets');
      await addWorkspace(name, home, secrets);
      // Reload so the new workspace-scoped storage is picked up
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create workspace.');
      setIsBusy(false);
    }
  };

  const handleImport = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const result = await importWorkspaceFromFile();
      if (result.success) {
        onCreated();
      } else {
        setError(result.error || 'Import failed.');
        setIsBusy(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setIsBusy(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-start bg-fetchy-bg overflow-y-auto p-6 pt-8">
      <div className="w-full max-w-lg space-y-5">
        {/* Logo + headline */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-3">
            <img src="./logo.jpg" alt="Fetchy" className="h-10 w-10 rounded-lg shadow-lg" />
            <span className="text-2xl font-bold text-fetchy-accent">Fetchy</span>
          </div>
          <h1 className="text-lg font-semibold text-white">Create your first workspace</h1>
          <p className="text-xs text-fetchy-text-muted max-w-sm">
            Workspaces keep your collections, environments, APIs and secrets fully isolated from one
            another. You must create one to continue.
          </p>
        </div>

        {/* Feature badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {/* Isolation badge */}
          <div className="relative group">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs cursor-default select-none">
              <Layers size={11} /> Isolation
            </span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg p-3 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl text-left">
              Every workspace has its own collections, environments, history, and secrets — completely separated from other workspaces.
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2d2d44]" />
            </div>
          </div>
          {/* Security badge */}
          <div className="relative group">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs cursor-default select-none">
              <Lock size={11} /> Security
            </span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg p-3 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl text-left">
              Secret variable values are stored in a separate directory so you can safely version-control your home directory without exposing secrets.
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2d2d44]" />
            </div>
          </div>
          {/* Git Native badge */}
          <div className="relative group">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs cursor-default select-none">
              <GitBranch size={11} /> Git Native
            </span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg p-3 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl text-left">
              Clone a Git repository as your workspace to keep collections and environments version-controlled and synced across machines.
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2d2d44]" />
            </div>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6 space-y-5 shadow-xl">
          {/* Mode tabs */}
          {isElectron && (
            <div className="flex border-b border-[#2d2d44] -mx-6 -mt-6 px-6 pt-4 mb-2">
              <button
                onClick={() => { setMode('manual'); setError(null); }}
                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${mode === 'manual' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-white'}`}
              >
                <Layers size={13} />
                New Workspace
              </button>
              <button
                onClick={() => { setMode('git'); setError(null); checkGit(); }}
                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${mode === 'git' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-white'}`}
              >
                <GitBranch size={13} />
                Clone from Git
              </button>
            </div>
          )}

          {mode === 'manual' ? (
            /* ──── Manual workspace creation ──── */
            <>
              <div className="flex items-center gap-2 mb-1">
                <Layers size={16} className="text-purple-400" />
                <span className="text-sm font-semibold text-white">New workspace</span>
              </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Workspace name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500"
              placeholder="e.g. My Project"
              autoFocus
            />
          </div>

          {/* Directories � Electron only */}
          {isElectron && (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <FolderOpen size={12} />
                  Home directory *
                  <span className="text-gray-600 ml-1">� collections, environments, APIs</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.homeDirectory}
                    onChange={(e) => setForm((p) => ({ ...p, homeDirectory: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm font-mono focus:outline-none focus:border-purple-500"
                    placeholder="/path/to/home"
                  />
                  <button
                    onClick={() => pickDirectory('homeDirectory')}
                    className="px-3 py-2 bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] transition-colors"
                    title="Browse"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <Lock size={12} />
                  Secrets directory *
                  <span className="text-gray-600 ml-1">� secret variable values only</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.secretsDirectory}
                    onChange={(e) => setForm((p) => ({ ...p, secretsDirectory: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm font-mono focus:outline-none focus:border-purple-500"
                    placeholder="/path/to/secrets"
                  />
                  <button
                    onClick={() => pickDirectory('secretsDirectory')}
                    className="px-3 py-2 bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] transition-colors"
                    title="Browse"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Store this outside version control to keep secrets safe.
                </p>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleCreate}
              disabled={isBusy}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium text-sm"
            >
              {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <Layers size={14} />}
              Create workspace
            </button>

            {isElectron && (
              <button
                onClick={handleImport}
                disabled={isBusy}
                className="flex items-center gap-2 px-4 py-2 bg-[#2d2d44] text-gray-300 rounded-lg hover:bg-[#3d3d54] disabled:opacity-50 transition-colors text-sm"
              >
                <Upload size={14} />
                Import from file
              </button>
            )}
          </div>
            </>
          ) : (
            /* ──── Clone from Git ──── */
            <>
              <div className="flex items-center gap-2 mb-1">
                <GitBranch size={16} className="text-purple-400" />
                <span className="text-sm font-semibold text-white">Clone from Git repository</span>
              </div>
              <p className="text-xs text-gray-400">
                Clone an existing Git repository containing your collections, environments, and API definitions directly into a new workspace.
              </p>

              {gitAvailable === false && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Git is not installed. Install it from <a href="https://git-scm.com/downloads" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">git-scm.com</a> and restart Fetchy.</span>
                </div>
              )}

              {gitAvailable !== false && (
                <>
                  {/* Workspace name */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Workspace name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500"
                      placeholder="e.g. My Project"
                    />
                  </div>

                  {/* Repository URL */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <GitBranch size={12} />
                      Repository URL *
                    </label>
                    <input
                      type="text"
                      value={gitUrl}
                      onChange={(e) => setGitUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm font-mono focus:outline-none focus:border-purple-500"
                      placeholder="https://github.com/user/repo.git"
                    />
                  </div>

                  {/* Clone target directory */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <FolderOpen size={12} />
                      Clone into directory *
                      <span className="text-gray-600 ml-1">— will become the home directory</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={gitDirectory}
                        onChange={(e) => setGitDirectory(e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm font-mono focus:outline-none focus:border-purple-500"
                        placeholder="/path/to/clone"
                      />
                      <button
                        onClick={async () => {
                          if (!window.electronAPI) return;
                          const dir = await window.electronAPI.selectDirectory({ title: 'Select directory for repository clone' });
                          if (dir) setGitDirectory(dir);
                        }}
                        className="px-3 py-2 bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] transition-colors"
                        title="Browse"
                      >
                        <FolderOpen size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Secrets directory */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <Lock size={12} />
                      Secrets directory *
                      <span className="text-gray-600 ml-1">— secret variable values only</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.secretsDirectory}
                        onChange={(e) => setForm((p) => ({ ...p, secretsDirectory: e.target.value }))}
                        className="flex-1 px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm font-mono focus:outline-none focus:border-purple-500"
                        placeholder="/path/to/secrets"
                      />
                      <button
                        onClick={() => pickDirectory('secretsDirectory')}
                        className="px-3 py-2 bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] transition-colors"
                        title="Browse"
                      >
                        <FolderOpen size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Store this outside the repository to keep secrets safe — it is excluded via .gitignore.
                    </p>
                  </div>

                  {/* Clone status */}
                  {gitCloneStatus !== 'idle' && (
                    <div
                      className={`flex items-center gap-2 p-2.5 rounded text-xs border ${
                        gitCloneStatus === 'cloning'
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                          : gitCloneStatus === 'success'
                          ? 'bg-green-500/10 border-green-500/30 text-green-300'
                          : 'bg-red-500/10 border-red-500/30 text-red-300'
                      }`}
                    >
                      {gitCloneStatus === 'cloning' && <Loader2 size={12} className="animate-spin shrink-0" />}
                      {gitCloneStatus === 'success' && <Check size={12} className="shrink-0" />}
                      {gitCloneStatus === 'error' && <AlertCircle size={12} className="shrink-0" />}
                      <span className="truncate">{gitCloneMessage}</span>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
                      {error}
                    </p>
                  )}

                  {/* Git actions */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={async () => {
                        const name = form.name.trim();
                        if (!name) { setError('Please enter a workspace name.'); return; }
                        if (!gitUrl.trim()) { setError('Please enter a repository URL.'); return; }
                        if (!gitDirectory.trim()) { setError('Please select a directory to clone into.'); return; }
                        if (!form.secretsDirectory.trim()) { setError('Please select a secrets directory.'); return; }
                        if (!window.electronAPI) return;

                        setError(null);
                        setGitCloneStatus('cloning');
                        setGitCloneMessage('Cloning repository... this may take a moment.');
                        setIsBusy(true);

                        try {
                          const cloneResult = await window.electronAPI.gitClone({
                            url: gitUrl.trim(),
                            directory: gitDirectory.trim(),
                          });
                          if (!cloneResult.success) {
                            setGitCloneStatus('error');
                            setGitCloneMessage(cloneResult.error || 'Clone failed');
                            setIsBusy(false);
                            return;
                          }

                          setGitCloneStatus('success');
                          setGitCloneMessage('Repository cloned — creating workspace...');

                          // Create workspace with cloned directory as home
                          await addWorkspace(name, gitDirectory.trim(), form.secretsDirectory.trim());

                          // Update the workspace to enable git auto-sync
                          const wsStore = useWorkspacesStore.getState();
                          const newWs = wsStore.workspaces.find((w) => w.homeDirectory === gitDirectory.trim());
                          if (newWs) {
                            await wsStore.updateWorkspace(newWs.id, { gitAutoSync: true });
                          }

                          onCreated();
                        } catch (e) {
                          setGitCloneStatus('error');
                          setGitCloneMessage(e instanceof Error ? e.message : 'Clone failed');
                          setIsBusy(false);
                        }
                      }}
                      disabled={isBusy || gitAvailable !== true}
                      className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium text-sm"
                    >
                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      Clone & Create Workspace
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
