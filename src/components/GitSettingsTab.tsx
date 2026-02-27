import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  RefreshCw,
  Download,
  Upload,
  FolderGit2,
  AlertCircle,
  Check,
  Loader2,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Clock,
  FileCode,
  Info,
  Link2,
  Unlink,
} from 'lucide-react';
import type {
  GitStatusResult,
  GitCommitInfo,
  Workspace,
} from '../types';
import { useAppStore } from '../store/appStore';

interface GitSettingsTabProps {
  workspace: Workspace | null;
  onWorkspaceUpdate?: (id: string, updates: Partial<Workspace>) => void;
}

type OpStatus = 'idle' | 'loading' | 'success' | 'error';

export default function GitSettingsTab({ workspace, onWorkspaceUpdate }: GitSettingsTabProps) {
  const [gitAvailable, setGitAvailable] = useState<boolean | null>(null);
  const [gitVersion, setGitVersion] = useState('');
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [commits, setCommits] = useState<GitCommitInfo[]>([]);
  const [cloneUrl, setCloneUrl] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [opStatus, setOpStatus] = useState<OpStatus>('idle');
  const [opMessage, setOpMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [showRemoteForm, setShowRemoteForm] = useState(false);
  const [autoSync, setAutoSync] = useState(workspace?.gitAutoSync ?? false);
  const opTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const api = window.electronAPI;
  const homeDir = workspace?.homeDirectory ?? '';

  const clearOpStatus = useCallback(() => {
    if (opTimerRef.current) clearTimeout(opTimerRef.current);
    opTimerRef.current = setTimeout(() => {
      setOpStatus('idle');
      setOpMessage('');
    }, 5000);
  }, []);

  const showOp = useCallback(
    (status: OpStatus, msg: string) => {
      setOpStatus(status);
      setOpMessage(msg);
      if (status !== 'loading') clearOpStatus();
    },
    [clearOpStatus]
  );

  // Check git availability
  useEffect(() => {
    if (!api) return;
    api.gitCheck().then((r) => {
      setGitAvailable(r.available);
      setGitVersion(r.version);
    });
  }, [api]);

  // Fetch status whenever workspace changes
  const refreshStatus = useCallback(async () => {
    if (!api || !homeDir) return;
    setIsRefreshing(true);
    try {
      const [statusRes, logRes] = await Promise.all([
        api.gitStatus({ directory: homeDir }),
        api.gitLog({ directory: homeDir, count: 15 }),
      ]);
      setStatus(statusRes);
      if (logRes.success && logRes.commits) setCommits(logRes.commits);
      else setCommits([]);
      if (statusRes.success && statusRes.remoteUrl) {
        setRemoteUrl(statusRes.remoteUrl);
      }
    } catch (e) {
      console.error('Git status refresh failed:', e);
    }
    setIsRefreshing(false);
  }, [api, homeDir]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Auto-sync toggle
  const handleAutoSyncToggle = useCallback(
    (checked: boolean) => {
      setAutoSync(checked);
      if (workspace && onWorkspaceUpdate) {
        onWorkspaceUpdate(workspace.id, { gitAutoSync: checked });
      }
    },
    [workspace, onWorkspaceUpdate]
  );

  // Init repo
  const handleInit = useCallback(async () => {
    if (!api || !homeDir) return;
    showOp('loading', 'Initializing repository...');
    const result = await api.gitInit({ directory: homeDir });
    if (result.success) {
      showOp('success', 'Repository initialized');
      refreshStatus();
    } else {
      showOp('error', result.error || 'Failed to initialize');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Clone repo
  const handleClone = useCallback(async () => {
    if (!api || !homeDir || !cloneUrl.trim()) return;
    showOp('loading', 'Cloning repository... this may take a while.');
    const result = await api.gitClone({ url: cloneUrl.trim(), directory: homeDir });
    if (result.success) {
      showOp('success', 'Repository cloned successfully');
      setCloneUrl('');
      setShowCloneForm(false);
      refreshStatus();
    } else {
      showOp('error', result.error || 'Clone failed');
    }
  }, [api, homeDir, cloneUrl, showOp, refreshStatus]);

  // Pull
  const handlePull = useCallback(async () => {
    if (!api || !homeDir) return;
    showOp('loading', 'Pulling from remote...');
    const result = await api.gitPull({ directory: homeDir });
    if (result.success) {
      showOp('success', result.output || 'Pull completed');
      refreshStatus();
      // Reload the app store so UI reflects changes from the pulled files
      await useAppStore.persist.rehydrate();
    } else {
      showOp('error', result.error || 'Pull failed');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Push
  const handlePush = useCallback(async () => {
    if (!api || !homeDir) return;
    showOp('loading', 'Pushing to remote...');
    const result = await api.gitPush({ directory: homeDir });
    if (result.success) {
      showOp('success', result.output || 'Push completed');
      refreshStatus();
    } else {
      showOp('error', result.error || 'Push failed');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Commit
  const handleCommit = useCallback(async () => {
    if (!api || !homeDir) return;
    const msg = commitMessage.trim() || `Fetchy commit ${new Date().toISOString()}`;
    showOp('loading', 'Committing changes...');
    const result = await api.gitAddCommit({ directory: homeDir, message: msg });
    if (result.success) {
      showOp('success', result.output || 'Changes committed');
      setCommitMessage('');
      refreshStatus();
    } else {
      showOp('error', result.error || 'Commit failed');
    }
  }, [api, homeDir, commitMessage, showOp, refreshStatus]);

  // Commit + Push
  const handleCommitAndPush = useCallback(async () => {
    if (!api || !homeDir) return;
    const msg = commitMessage.trim() || `Fetchy sync ${new Date().toISOString()}`;
    showOp('loading', 'Committing and pushing...');
    const result = await api.gitAddCommitPush({ directory: homeDir, message: msg });
    if (result.success) {
      showOp('success', result.output || 'Changes synced');
      setCommitMessage('');
      refreshStatus();
    } else {
      showOp('error', result.error || 'Sync failed');
    }
  }, [api, homeDir, commitMessage, showOp, refreshStatus]);

  // Set remote
  const handleSetRemote = useCallback(async () => {
    if (!api || !homeDir || !remoteUrl.trim()) return;
    showOp('loading', 'Setting remote...');
    const result = await api.gitRemoteSet({ directory: homeDir, url: remoteUrl.trim() });
    if (result.success) {
      showOp('success', 'Remote URL updated');
      setShowRemoteForm(false);
      refreshStatus();
    } else {
      showOp('error', result.error || 'Failed to set remote');
    }
  }, [api, homeDir, remoteUrl, showOp, refreshStatus]);

  // Fetch
  const handleFetch = useCallback(async () => {
    if (!api || !homeDir) return;
    showOp('loading', 'Fetching from remote...');
    const result = await api.gitFetch({ directory: homeDir });
    if (result.success) {
      showOp('success', 'Fetch completed');
      refreshStatus();
    } else {
      showOp('error', result.error || 'Fetch failed');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // No workspace selected
  if (!workspace) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-gray-500'>
        <FolderGit2 size={32} className='mb-3 opacity-50' />
        <p className='text-sm'>No workspace selected.</p>
        <p className='text-xs mt-1'>Create or switch to a workspace to use Git integration.</p>
      </div>
    );
  }

  // Not running in Electron
  if (!api) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-gray-500'>
        <AlertCircle size={32} className='mb-3 opacity-50' />
        <p className='text-sm'>Git integration requires the desktop app.</p>
      </div>
    );
  }

  // Git not installed
  if (gitAvailable === false) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-gray-500'>
        <AlertCircle size={32} className='mb-3 text-red-400' />
        <p className='text-sm text-white'>Git is not installed on your system.</p>
        <p className='text-xs mt-2 text-gray-400 text-center max-w-sm'>
          Install Git from{' '}
          <a
            href='https://git-scm.com/downloads'
            target='_blank'
            rel='noopener noreferrer'
            className='text-purple-400 hover:underline inline-flex items-center gap-1'
          >
            git-scm.com <ExternalLink size={10} />
          </a>{' '}
          and restart Fetchy to enable Git integration.
        </p>
      </div>
    );
  }

  // Still loading
  if (gitAvailable === null) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 size={20} className='animate-spin text-purple-400' />
        <span className='ml-2 text-sm text-gray-400'>Checking git...</span>
      </div>
    );
  }

  const isRepo = status?.isRepo === true;
  const hasRemote = !!status?.remoteUrl;

  return (
    <div className='space-y-5'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <FolderGit2 size={16} className='text-purple-400' />
          <div>
            <span className='text-sm text-white font-medium'>Git Integration</span>
            <p className='text-xs text-gray-500'>{gitVersion}</p>
          </div>
        </div>
        <button
          onClick={refreshStatus}
          disabled={isRefreshing}
          className='p-1.5 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded transition-colors disabled:opacity-50'
          title='Refresh status'
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Operation status bar */}
      {opStatus !== 'idle' && (
        <div
          className={`flex items-center gap-2 p-2.5 rounded text-xs border ${
            opStatus === 'loading'
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              : opStatus === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {opStatus === 'loading' && <Loader2 size={12} className='animate-spin shrink-0' />}
          {opStatus === 'success' && <Check size={12} className='shrink-0' />}
          {opStatus === 'error' && <AlertCircle size={12} className='shrink-0' />}
          <span className='truncate'>{opMessage}</span>
        </div>
      )}

      {/* Workspace directory */}
      <div className='p-3 bg-[#0f0f1a] rounded border border-[#2d2d44]'>
        <p className='text-xs text-gray-500 mb-1'>Workspace Directory</p>
        <p className='text-sm text-gray-300 font-mono truncate'>{homeDir}</p>
      </div>

      {/* Not a repo — show init/clone options */}
      {!isRepo && (
        <div className='space-y-3'>
          <div className='p-4 bg-[#0f0f1a] rounded border border-[#2d2d44] space-y-3'>
            <div className='flex items-start gap-2'>
              <Info size={14} className='text-purple-400 mt-0.5 shrink-0' />
              <p className='text-xs text-gray-400'>
                This workspace is not a Git repository yet. Initialize a new repository or clone an existing one to enable version control for your collections, environments, and APIs.
              </p>
            </div>

            <div className='flex gap-2'>
              <button
                onClick={handleInit}
                disabled={opStatus === 'loading'}
                className='flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50'
              >
                <GitBranch size={12} />
                Initialize Repository
              </button>
              <button
                onClick={() => setShowCloneForm(!showCloneForm)}
                disabled={opStatus === 'loading'}
                className='flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1a1a2e] text-gray-300 rounded border border-[#2d2d44] hover:bg-[#2d2d44] transition-colors disabled:opacity-50'
              >
                <Download size={12} />
                Clone Repository
              </button>
            </div>

            {showCloneForm && (
              <div className='space-y-2 pt-2 border-t border-[#2d2d44]'>
                <label className='text-xs text-gray-400'>Repository URL</label>
                <div className='flex gap-2'>
                  <input
                    type='text'
                    value={cloneUrl}
                    onChange={(e) => setCloneUrl(e.target.value)}
                    placeholder='https://github.com/user/repo.git'
                    className='flex-1 px-3 py-1.5 bg-[#1a1a2e] border border-[#2d2d44] rounded text-white text-xs font-mono focus:outline-none focus:border-purple-500'
                  />
                  <button
                    onClick={handleClone}
                    disabled={opStatus === 'loading' || !cloneUrl.trim()}
                    className='px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-1'
                  >
                    {opStatus === 'loading' ? (
                      <Loader2 size={12} className='animate-spin' />
                    ) : (
                      <Download size={12} />
                    )}
                    Clone
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Repo is initialized — show full controls */}
      {isRepo && (
        <>
          {/* Branch & status row */}
          <div className='grid grid-cols-2 gap-3'>
            <div className='p-3 bg-[#0f0f1a] rounded border border-[#2d2d44]'>
              <div className='flex items-center gap-1.5 mb-1'>
                <GitBranch size={12} className='text-purple-400' />
                <span className='text-xs text-gray-500'>Branch</span>
              </div>
              <p className='text-sm text-white font-mono'>{status?.branch || 'unknown'}</p>
            </div>
            <div className='p-3 bg-[#0f0f1a] rounded border border-[#2d2d44]'>
              <div className='flex items-center gap-1.5 mb-1'>
                <FileCode size={12} className='text-purple-400' />
                <span className='text-xs text-gray-500'>Changes</span>
              </div>
              <p className={`text-sm font-mono ${status?.hasChanges ? 'text-yellow-400' : 'text-green-400'}`}>
                {status?.changes?.length ?? 0} file{(status?.changes?.length ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Ahead/behind indicators */}
          {hasRemote && (status?.ahead || status?.behind) ? (
            <div className='flex gap-3'>
              {(status?.ahead ?? 0) > 0 && (
                <div className='flex items-center gap-1 text-xs text-green-400'>
                  <ArrowUp size={12} />
                  <span>{status?.ahead} ahead</span>
                </div>
              )}
              {(status?.behind ?? 0) > 0 && (
                <div className='flex items-center gap-1 text-xs text-orange-400'>
                  <ArrowDown size={12} />
                  <span>{status?.behind} behind</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Remote URL */}
          <div className='p-3 bg-[#0f0f1a] rounded border border-[#2d2d44]'>
            <div className='flex items-center justify-between mb-1'>
              <div className='flex items-center gap-1.5'>
                <Link2 size={12} className='text-purple-400' />
                <span className='text-xs text-gray-500'>Remote (origin)</span>
              </div>
              <button
                onClick={() => setShowRemoteForm(!showRemoteForm)}
                className='text-xs text-purple-400 hover:text-purple-300 transition-colors'
              >
                {hasRemote ? 'Change' : 'Set Remote'}
              </button>
            </div>
            {hasRemote ? (
              <p className='text-xs text-gray-300 font-mono truncate'>{status?.remoteUrl}</p>
            ) : (
              <p className='text-xs text-gray-500 flex items-center gap-1'>
                <Unlink size={10} />
                No remote configured
              </p>
            )}
            {showRemoteForm && (
              <div className='flex gap-2 mt-2'>
                <input
                  type='text'
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  placeholder='https://github.com/user/repo.git'
                  className='flex-1 px-2 py-1 bg-[#1a1a2e] border border-[#2d2d44] rounded text-white text-xs font-mono focus:outline-none focus:border-purple-500'
                />
                <button
                  onClick={handleSetRemote}
                  disabled={opStatus === 'loading' || !remoteUrl.trim()}
                  className='px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50'
                >
                  Save
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className='space-y-3'>
            <h4 className='text-xs font-medium text-gray-400 uppercase tracking-wider'>Actions</h4>
            <div className='flex flex-wrap gap-2'>
              <button
                onClick={handleFetch}
                disabled={opStatus === 'loading' || !hasRemote}
                className='flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1a1a2e] text-gray-300 rounded border border-[#2d2d44] hover:bg-[#2d2d44] transition-colors disabled:opacity-50'
                title={!hasRemote ? 'Set a remote first' : 'Fetch latest from remote'}
              >
                <RefreshCw size={12} />
                Fetch
              </button>
              <button
                onClick={handlePull}
                disabled={opStatus === 'loading' || !hasRemote}
                className='flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1a1a2e] text-gray-300 rounded border border-[#2d2d44] hover:bg-[#2d2d44] transition-colors disabled:opacity-50'
                title={!hasRemote ? 'Set a remote first' : 'Pull changes from remote'}
              >
                <Download size={12} />
                Pull
              </button>
              <button
                onClick={handlePush}
                disabled={opStatus === 'loading' || !hasRemote}
                className='flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1a1a2e] text-gray-300 rounded border border-[#2d2d44] hover:bg-[#2d2d44] transition-colors disabled:opacity-50'
                title={!hasRemote ? 'Set a remote first' : 'Push commits to remote'}
              >
                <Upload size={12} />
                Push
              </button>
            </div>
          </div>

          {/* Commit area */}
          <div className='space-y-2'>
            <h4 className='text-xs font-medium text-gray-400 uppercase tracking-wider'>Commit Changes</h4>
            <div className='flex gap-2'>
              <input
                type='text'
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder='Commit message (optional)'
                className='flex-1 px-3 py-1.5 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-xs focus:outline-none focus:border-purple-500'
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommit();
                }}
              />
              <button
                onClick={handleCommit}
                disabled={opStatus === 'loading' || !status?.hasChanges}
                className='flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50'
              >
                <GitCommitHorizontal size={12} />
                Commit
              </button>
              {hasRemote && (
                <button
                  onClick={handleCommitAndPush}
                  disabled={opStatus === 'loading' || !status?.hasChanges}
                  className='flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50'
                  title='Commit all changes and push to remote'
                >
                  <GitPullRequest size={12} />
                  Commit & Push
                </button>
              )}
            </div>
            {status?.hasChanges && (
              <div className='max-h-24 overflow-y-auto p-2 bg-[#0f0f1a] rounded border border-[#2d2d44]'>
                {status.changes?.map((change, idx) => (
                  <p key={idx} className='text-xs font-mono text-gray-400 leading-relaxed'>
                    <span
                      className={
                        change.startsWith(' M') || change.startsWith('M ')
                          ? 'text-yellow-400'
                          : change.startsWith('??')
                          ? 'text-green-400'
                          : change.startsWith(' D') || change.startsWith('D ')
                          ? 'text-red-400'
                          : 'text-gray-400'
                      }
                    >
                      {change.slice(0, 2)}
                    </span>{' '}
                    {change.slice(3)}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Auto-sync toggle */}
          <div className='border-t border-[#2d2d44] pt-4'>
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm text-gray-300 font-medium'>Auto-sync</label>
                <p className='text-xs text-gray-500'>
                  Automatically commit and push when collections or environments change
                </p>
              </div>
              <input
                type='checkbox'
                checked={autoSync}
                onChange={(e) => handleAutoSyncToggle(e.target.checked)}
                disabled={!hasRemote}
                className='w-4 h-4 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-500 focus:ring-purple-500'
              />
            </div>
            {!hasRemote && autoSync === false && (
              <p className='text-xs text-gray-600 mt-1'>Configure a remote to enable auto-sync.</p>
            )}
            {autoSync && (
              <div className='mt-2 p-2.5 bg-purple-500/10 border border-purple-500/30 rounded text-xs text-purple-300 flex items-start gap-2'>
                <Info size={12} className='shrink-0 mt-0.5' />
                <p>
                  Changes are automatically committed and pushed after each save. Make sure your Git credentials are configured for the remote.
                </p>
              </div>
            )}
          </div>

          {/* Recent commits */}
          {commits.length > 0 && (
            <div className='space-y-2'>
              <h4 className='text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5'>
                <Clock size={12} />
                Recent Commits
              </h4>
              <div className='max-h-48 overflow-y-auto space-y-1'>
                {commits.map((c, idx) => (
                  <div
                    key={idx}
                    className='p-2 bg-[#0f0f1a] rounded border border-[#2d2d44] hover:border-[#3d3d54] transition-colors'
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <p className='text-xs text-white truncate flex-1'>{c.message}</p>
                      <span className='text-[10px] font-mono text-gray-600 shrink-0'>
                        {c.hash.slice(0, 7)}
                      </span>
                    </div>
                    <div className='flex items-center gap-2 mt-0.5'>
                      <span className='text-[10px] text-gray-500'>{c.author}</span>
                      <span className='text-[10px] text-gray-600'>
                        {c.date ? new Date(c.date).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
