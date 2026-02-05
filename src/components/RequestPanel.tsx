import { useState, useEffect, useCallback } from 'react';
import { Send, Save, Plus, Trash2, FileText, X, Link, Terminal, Check, Code, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { ApiRequest, ApiResponse, HttpMethod, KeyValue } from '../types';
import { executeRequest } from '../utils/httpClient';
import { resolveRequestVariables, generateCurl, generateJavaScript, generatePython, generateJava, generateDotNet, generateGo, generateRust, generateCpp } from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';
import VariableInput from './VariableInput';
import VariableTextarea from './VariableTextarea';

interface RequestPanelProps {
  setResponse: (response: ApiResponse | null) => void;
  setSentRequest?: (request: ApiRequest | null) => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default function RequestPanel({ setResponse, setSentRequest, setIsLoading, isLoading }: RequestPanelProps) {
  const {
    tabs,
    activeTabId,
    getRequest,
    updateRequest,
    updateTab,
    collections,
    getActiveEnvironment,
    addToHistory,
  } = useAppStore();

  const activeTab = tabs.find(t => t.id === activeTabId);
  const [request, setLocalRequest] = useState<ApiRequest | null>(null);
  const [activeSection, setActiveSection] = useState<'params' | 'headers' | 'body' | 'auth'>('params');
  const [batchEditModal, setBatchEditModal] = useState<{ open: boolean; field: 'headers' | 'params' | null }>({ open: false, field: null });
  const [batchEditText, setBatchEditText] = useState('');
  const [codeModal, setCodeModal] = useState<{ open: boolean; activeLanguage: string; copied: boolean }>({ open: false, activeLanguage: 'curl', copied: false });
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);

  // Load request data when tab changes
  useEffect(() => {
    if (activeTab?.collectionId && activeTab?.requestId) {
      const req = getRequest(activeTab.collectionId, activeTab.requestId);
      if (req) {
        setLocalRequest({ ...req });
      }
    }
  }, [activeTab?.requestId, activeTab?.collectionId, getRequest]);

  const handleShowCode = useCallback((language: string = 'curl') => {
    if (!request) return;
    setCodeModal({ open: true, activeLanguage: language, copied: false });
    setShowCodeDropdown(false);
  }, [request]);

  const getCodeForLanguage = (language: string): string => {
    if (!request) return '';

    const collection = collections.find(c => c.id === activeTab?.collectionId);
    const environment = getActiveEnvironment();
    const allVariables = [
      ...(collection?.variables || []),
      ...(environment?.variables || []),
    ];

    switch (language) {
      case 'curl':
        return generateCurl(request, allVariables);
      case 'javascript':
        return generateJavaScript(request, allVariables);
      case 'python':
        return generatePython(request, allVariables);
      case 'java':
        return generateJava(request, allVariables);
      case 'dotnet':
        return generateDotNet(request, allVariables);
      case 'go':
        return generateGo(request, allVariables);
      case 'rust':
        return generateRust(request, allVariables);
      case 'cpp':
        return generateCpp(request, allVariables);
      default:
        return '';
    }
  };

  const handleCopyCode = () => {
    const code = getCodeForLanguage(codeModal.activeLanguage);
    navigator.clipboard.writeText(code);
    setCodeModal({ ...codeModal, copied: true });
    setTimeout(() => setCodeModal({ ...codeModal, copied: false }), 2000);
  };

  const handleSave = useCallback(() => {
    if (request && activeTab?.collectionId) {
      updateRequest(activeTab.collectionId, request.id, request);
      updateTab(activeTab.id, { isModified: false, title: request.name });
    }
  }, [request, activeTab, updateRequest, updateTab]);

  const handleChange = useCallback((updates: Partial<ApiRequest>) => {
    if (request) {
      const updated = { ...request, ...updates };
      setLocalRequest(updated);
      if (activeTab) {
        updateTab(activeTab.id, { isModified: true });
      }
    }
  }, [request, activeTab, updateTab]);

  // Get inherited auth from collection or folder
  const getInheritedAuth = useCallback(() => {
    if (!activeTab?.collectionId) return null;
    const collection = collections.find(c => c.id === activeTab.collectionId);
    if (!collection) return null;

    // If request is in a folder, check folder auth first
    if (activeTab.folderId) {
      const findFolderAuth = (folders: typeof collection.folders, folderId: string): typeof collection.auth | null => {
        for (const folder of folders) {
          if (folder.id === folderId) {
            if (folder.auth && folder.auth.type !== 'none' && folder.auth.type !== 'inherit') {
              return folder.auth;
            }
            return null;
          }
          const result = findFolderAuth(folder.folders, folderId);
          if (result !== null) return result;
        }
        return null;
      };
      const folderAuth = findFolderAuth(collection.folders, activeTab.folderId);
      if (folderAuth) return folderAuth;
    }

    // Fall back to collection auth
    if (collection.auth && collection.auth.type !== 'none' && collection.auth.type !== 'inherit') {
      return collection.auth;
    }
    return null;
  }, [activeTab?.collectionId, activeTab?.folderId, collections]);

  const handleSend = useCallback(async () => {
    if (!request || isLoading) return;

    setIsLoading(true);
    setResponse(null);

    const collection = collections.find(c => c.id === activeTab?.collectionId);
    const environment = getActiveEnvironment();
    const inheritedAuth = getInheritedAuth();

    // Resolve variables for history and sentRequest display
    const resolvedRequest = resolveRequestVariables(
      request,
      collection?.variables || [],
      environment?.variables || []
    );

    setSentRequest?.(resolvedRequest);

    try {
      const response = await executeRequest({
        request,
        collectionVariables: collection?.variables || [],
        environmentVariables: environment?.variables || [],
        inheritedAuth,
      });

      setResponse(response);
      // Save to history with resolved variables so actual values are shown
      addToHistory({ request: resolvedRequest, response });
    } catch (error) {
      console.error('Request failed:', error);
      setResponse({
        status: 0,
        statusText: 'Error',
        headers: {},
        body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        time: 0,
        size: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [request, isLoading, setIsLoading, setResponse, setSentRequest, collections, activeTab, getActiveEnvironment, getInheritedAuth, addToHistory]);

  // Keyboard shortcuts for save (Ctrl+S) and send (Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSend]);

  const addKeyValue = (field: 'headers' | 'params') => {
    if (!request) return;
    const newKv: KeyValue = { id: uuidv4(), key: '', value: '', enabled: true };
    handleChange({ [field]: [...request[field], newKv] });
  };

  const updateKeyValue = (field: 'headers' | 'params', id: string, updates: Partial<KeyValue>) => {
    if (!request) return;
    handleChange({
      [field]: request[field].map(kv => kv.id === id ? { ...kv, ...updates } : kv),
    });
  };

  const removeKeyValue = (field: 'headers' | 'params', id: string) => {
    if (!request) return;
    handleChange({
      [field]: request[field].filter(kv => kv.id !== id),
    });
  };

  const openBatchEdit = (field: 'headers' | 'params') => {
    if (!request) return;
    // Convert key-value pairs to text format (key: value per line)
    const text = request[field]
      .map(kv => `${kv.enabled ? '' : '# '}${kv.key}: ${kv.value}`)
      .join('\n');
    setBatchEditText(text);
    setBatchEditModal({ open: true, field });
  };

  const applyBatchEdit = () => {
    if (!request || !batchEditModal.field) return;

    // Parse text back to key-value pairs
    const lines = batchEditText.split('\n').filter(line => line.trim());
    const newItems: KeyValue[] = lines.map(line => {
      const disabled = line.startsWith('# ');
      const cleanLine = disabled ? line.slice(2) : line;
      const colonIndex = cleanLine.indexOf(':');
      const key = colonIndex > -1 ? cleanLine.slice(0, colonIndex).trim() : cleanLine.trim();
      const value = colonIndex > -1 ? cleanLine.slice(colonIndex + 1).trim() : '';
      return {
        id: uuidv4(),
        key,
        value,
        enabled: !disabled,
      };
    });

    handleChange({ [batchEditModal.field]: newItems });
    setBatchEditModal({ open: false, field: null });
    setBatchEditText('');
  };


  if (!request) {
    return (
      <div className="h-full flex items-center justify-center text-aki-text-muted">
        <p>Select a request to edit</p>
      </div>
    );
  }

  const renderKeyValueTable = (field: 'headers' | 'params') => {
    const items = request[field];

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between gap-2 p-2 border-b border-aki-border">
          <button
            onClick={() => addKeyValue(field)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-aki-text-muted hover:text-aki-text hover:bg-aki-border rounded"
          >
            <Plus size={14} /> Add {field === 'headers' ? 'Header' : 'Parameter'}
          </button>
          <button
            onClick={() => openBatchEdit(field)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-aki-text-muted hover:text-aki-text hover:bg-aki-border rounded"
            title="Bulk Edit"
          >
            <FileText size={14} /> Bulk Edit
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full kv-table">
            <thead className="sticky top-0 bg-aki-bg">
              <tr className="text-left text-xs text-aki-text-muted border-b border-aki-border">
                <th className="w-8 p-2"></th>
                <th className="p-2">Key</th>
                <th className="p-2">Value</th>
                <th className="w-8 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-aki-border/50">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => updateKeyValue(field, item.id, { enabled: e.target.checked })}
                      className="w-4 h-4 accent-aki-accent"
                    />
                  </td>
                  <td className="p-0">
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) => updateKeyValue(field, item.id, { key: e.target.value })}
                      placeholder="Key"
                      className="w-full bg-transparent p-2 text-sm outline-none focus:bg-aki-card"
                    />
                  </td>
                  <td className="p-0">
                    <VariableInput
                      value={item.value}
                      onChange={(value) => updateKeyValue(field, item.id, { value })}
                      placeholder="Value"
                      className="w-full bg-transparent p-2 text-sm outline-none focus:bg-aki-card"
                    />
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => removeKeyValue(field, item.id)}
                      className="p-1 hover:bg-aki-border rounded text-aki-text-muted hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBody = () => {
    const bodyTypes = [
      { value: 'none', label: 'None' },
      { value: 'json', label: 'JSON' },
      { value: 'raw', label: 'Raw' },
      { value: 'x-www-form-urlencoded', label: 'URL Encoded' },
      { value: 'form-data', label: 'Form Data' },
    ];

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 p-2 border-b border-aki-border">
          {bodyTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => handleChange({ body: { ...request.body, type: type.value as any } })}
              className={`px-3 py-1 text-sm rounded ${
                request.body.type === type.value
                  ? 'bg-aki-accent text-white'
                  : 'text-aki-text-muted hover:text-aki-text hover:bg-aki-border'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {request.body.type === 'none' && (
            <div className="h-full flex items-center justify-center text-aki-text-muted">
              <p>This request does not have a body</p>
            </div>
          )}

          {(request.body.type === 'json' || request.body.type === 'raw') && (
            <VariableTextarea
              value={request.body.raw || ''}
              onChange={(value: string) => handleChange({ body: { ...request.body, raw: value } })}
              placeholder={request.body.type === 'json' ? '{\n  "key": "value"\n}' : 'Enter request body...'}
            />
          )}

          {request.body.type === 'x-www-form-urlencoded' && (
            <div className="p-2">
              <table className="w-full kv-table">
                <thead>
                  <tr className="text-left text-xs text-aki-text-muted border-b border-aki-border">
                    <th className="w-8 p-2"></th>
                    <th className="p-2">Key</th>
                    <th className="p-2">Value</th>
                    <th className="w-8 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(request.body.urlencoded || []).map((item) => (
                    <tr key={item.id} className="border-b border-aki-border/50">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => {
                            const updated = (request.body.urlencoded || []).map(u =>
                              u.id === item.id ? { ...u, enabled: e.target.checked } : u
                            );
                            handleChange({ body: { ...request.body, urlencoded: updated } });
                          }}
                          className="w-4 h-4 accent-aki-accent"
                        />
                      </td>
                      <td className="p-0">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(e) => {
                            const updated = (request.body.urlencoded || []).map(u =>
                              u.id === item.id ? { ...u, key: e.target.value } : u
                            );
                            handleChange({ body: { ...request.body, urlencoded: updated } });
                          }}
                          placeholder="Key"
                          className="w-full bg-transparent p-2 text-sm outline-none focus:bg-aki-card"
                        />
                      </td>
                      <td className="p-0">
                        <VariableInput
                          value={item.value}
                          onChange={(value) => {
                            const updated = (request.body.urlencoded || []).map(u =>
                              u.id === item.id ? { ...u, value: value } : u
                            );
                            handleChange({ body: { ...request.body, urlencoded: updated } });
                          }}
                          placeholder="Value"
                          className="w-full bg-transparent p-2 text-sm outline-none focus:bg-aki-card"
                        />
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => {
                            const updated = (request.body.urlencoded || []).filter(u => u.id !== item.id);
                            handleChange({ body: { ...request.body, urlencoded: updated } });
                          }}
                          className="p-1 hover:bg-aki-border rounded text-aki-text-muted hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => {
                  const newItem: KeyValue = { id: uuidv4(), key: '', value: '', enabled: true };
                  handleChange({ body: { ...request.body, urlencoded: [...(request.body.urlencoded || []), newItem] } });
                }}
                className="flex items-center gap-1 px-3 py-2 text-sm text-aki-text-muted hover:text-aki-text"
              >
                <Plus size={14} /> Add Field
              </button>
            </div>
          )}

          {request.body.type === 'form-data' && (
            <div className="p-2">
              <table className="w-full kv-table">
                <thead>
                  <tr className="text-left text-xs text-aki-text-muted border-b border-aki-border">
                    <th className="w-8 p-2"></th>
                    <th className="p-2">Key</th>
                    <th className="p-2">Value</th>
                    <th className="w-8 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(request.body.formData || []).map((item) => (
                    <tr key={item.id} className="border-b border-aki-border/50">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => {
                            const updated = (request.body.formData || []).map(f =>
                              f.id === item.id ? { ...f, enabled: e.target.checked } : f
                            );
                            handleChange({ body: { ...request.body, formData: updated } });
                          }}
                          className="w-4 h-4 accent-aki-accent"
                        />
                      </td>
                      <td className="p-0">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(e) => {
                            const updated = (request.body.formData || []).map(f =>
                              f.id === item.id ? { ...f, key: e.target.value } : f
                            );
                            handleChange({ body: { ...request.body, formData: updated } });
                          }}
                          placeholder="Key"
                          className="w-full bg-transparent p-2 text-sm outline-none focus:bg-aki-card"
                        />
                      </td>
                      <td className="p-0">
                        <VariableInput
                          value={item.value}
                          onChange={(value) => {
                            const updated = (request.body.formData || []).map(f =>
                              f.id === item.id ? { ...f, value: value } : f
                            );
                            handleChange({ body: { ...request.body, formData: updated } });
                          }}
                          placeholder="Value"
                          className="w-full bg-transparent p-2 text-sm outline-none focus:bg-aki-card"
                        />
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => {
                            const updated = (request.body.formData || []).filter(f => f.id !== item.id);
                            handleChange({ body: { ...request.body, formData: updated } });
                          }}
                          className="p-1 hover:bg-aki-border rounded text-aki-text-muted hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => {
                  const newItem: KeyValue = { id: uuidv4(), key: '', value: '', enabled: true };
                  handleChange({ body: { ...request.body, formData: [...(request.body.formData || []), newItem] } });
                }}
                className="flex items-center gap-1 px-3 py-2 text-sm text-aki-text-muted hover:text-aki-text"
              >
                <Plus size={14} /> Add Field
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAuth = () => {
    const authTypes = [
      { value: 'inherit', label: 'Inherit' },
      { value: 'none', label: 'No Auth' },
      { value: 'basic', label: 'Basic Auth' },
      { value: 'bearer', label: 'Bearer Token' },
      { value: 'api-key', label: 'API Key' },
    ];

    const inheritedAuth = getInheritedAuth();
    const getAuthTypeLabel = (type: string) => {
      const found = authTypes.find(t => t.value === type);
      return found ? found.label : type;
    };

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 p-2 border-b border-aki-border">
          {authTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => handleChange({ auth: { ...request.auth, type: type.value as any } })}
              className={`px-3 py-1 text-sm rounded ${
                request.auth.type === type.value
                  ? 'bg-aki-accent text-white'
                  : 'text-aki-text-muted hover:text-aki-text hover:bg-aki-border'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 overflow-auto">
          {request.auth.type === 'inherit' && (
            <div className="space-y-4">
              {inheritedAuth ? (
                <div className="p-4 bg-aki-card rounded-lg border border-aki-border">
                  <div className="flex items-center gap-2 text-aki-text mb-2">
                    <Link size={16} className="text-aki-accent" />
                    <span className="font-medium">Inheriting auth from parent</span>
                  </div>
                  <div className="text-sm text-aki-text-muted space-y-1">
                    <p><span className="font-medium">Type:</span> {getAuthTypeLabel(inheritedAuth.type)}</p>
                    {inheritedAuth.type === 'basic' && (
                      <p><span className="font-medium">Username:</span> {inheritedAuth.basic?.username || '(not set)'}</p>
                    )}
                    {inheritedAuth.type === 'bearer' && (
                      <p><span className="font-medium">Token:</span> {inheritedAuth.bearer?.token ? '••••••••' : '(not set)'}</p>
                    )}
                    {inheritedAuth.type === 'api-key' && (
                      <>
                        <p><span className="font-medium">Key:</span> {inheritedAuth.apiKey?.key || '(not set)'}</p>
                        <p><span className="font-medium">Add to:</span> {inheritedAuth.apiKey?.addTo === 'header' ? 'Header' : 'Query Params'}</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-aki-text-muted text-center py-8">
                  <p>No auth configured in parent collection or folder</p>
                  <p className="text-xs mt-2">Configure auth at the collection or folder level to inherit it here</p>
                </div>
              )}
            </div>
          )}

          {request.auth.type === 'none' && (
            <div className="text-aki-text-muted text-center py-8">
              <p>This request does not require authentication</p>
            </div>
          )}

          {request.auth.type === 'basic' && (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm text-aki-text-muted mb-1">Username</label>
                <VariableInput
                  value={request.auth.basic?.username || ''}
                  onChange={(value) => handleChange({
                    auth: { ...request.auth, basic: { ...request.auth.basic, username: value, password: request.auth.basic?.password || '' } }
                  })}
                  className="w-full"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm text-aki-text-muted mb-1">Password</label>
                <VariableInput
                  value={request.auth.basic?.password || ''}
                  onChange={(value) => handleChange({
                    auth: { ...request.auth, basic: { ...request.auth.basic, username: request.auth.basic?.username || '', password: value } }
                  })}
                  className="w-full"
                  placeholder="Enter password"
                />
              </div>
            </div>
          )}

          {request.auth.type === 'bearer' && (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm text-aki-text-muted mb-1">Token</label>
                <VariableInput
                  value={request.auth.bearer?.token || ''}
                  onChange={(value) => handleChange({
                    auth: { ...request.auth, bearer: { token: value } }
                  })}
                  className="w-full"
                  placeholder="Enter bearer token"
                />
              </div>
            </div>
          )}

          {request.auth.type === 'api-key' && (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm text-aki-text-muted mb-1">Key</label>
                <VariableInput
                  value={request.auth.apiKey?.key || ''}
                  onChange={(value) => handleChange({
                    auth: { ...request.auth, apiKey: { ...request.auth.apiKey, key: value, value: request.auth.apiKey?.value || '', addTo: request.auth.apiKey?.addTo || 'header' } }
                  })}
                  className="w-full"
                  placeholder="e.g., X-API-Key"
                />
              </div>
              <div>
                <label className="block text-sm text-aki-text-muted mb-1">Value</label>
                <VariableInput
                  value={request.auth.apiKey?.value || ''}
                  onChange={(value) => handleChange({
                    auth: { ...request.auth, apiKey: { ...request.auth.apiKey, key: request.auth.apiKey?.key || '', value: value, addTo: request.auth.apiKey?.addTo || 'header' } }
                  })}
                  className="w-full"
                  placeholder="Enter API key value"
                />
              </div>
              <div>
                <label className="block text-sm text-aki-text-muted mb-1">Add to</label>
                <select
                  value={request.auth.apiKey?.addTo || 'header'}
                  onChange={(e) => handleChange({
                    auth: { ...request.auth, apiKey: { ...request.auth.apiKey, key: request.auth.apiKey?.key || '', value: request.auth.apiKey?.value || '', addTo: e.target.value as 'header' | 'query' } }
                  })}
                  className="w-full"
                >
                  <option value="header">Header</option>
                  <option value="query">Query Params</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-aki-bg">
      {/* URL bar */}
      <div className="px-4 py-3 border-b border-aki-border flex items-center gap-2">
        <select
          value={request.method}
          onChange={(e) => handleChange({ method: e.target.value as HttpMethod })}
          className="w-28 font-medium"
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method}>{method}</option>
          ))}
        </select>

        <VariableInput
          value={request.url}
          onChange={(url) => handleChange({ url })}
          className="flex-1"
          placeholder="Enter request URL (e.g., https://api.example.com/users)"
        />

        <button
          onClick={handleSend}
          disabled={isLoading || !request.url}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending
            </>
          ) : (
            <>
              <Send size={16} /> Send
            </>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowCodeDropdown(!showCodeDropdown)}
            disabled={!request.url}
            className="btn btn-secondary flex items-center gap-1.5 disabled:opacity-50 pr-2"
            title="Generate Code"
          >
            <Code size={16} className="text-purple-400" />
            <span className="font-medium">Code</span>
            <ChevronDown size={14} className="text-aki-text-muted" />
          </button>

          {showCodeDropdown && request.url && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowCodeDropdown(false)}
              />
              <div className="absolute top-full right-0 mt-1 w-48 bg-aki-bg border border-aki-border rounded-lg shadow-xl z-50 py-1 max-h-[400px] overflow-y-auto">
                {[
                  { id: 'curl', label: 'cURL', icon: '⚡' },
                  { id: 'javascript', label: 'JavaScript', icon: '🟨' },
                  { id: 'python', label: 'Python', icon: '🐍' },
                  { id: 'java', label: 'Java', icon: '☕' },
                  { id: 'dotnet', label: '.NET Core', icon: '🔷' },
                  { id: 'go', label: 'Go', icon: '🐹' },
                  { id: 'rust', label: 'Rust', icon: '🦀' },
                  { id: 'cpp', label: 'C++', icon: '⚙️' },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => handleShowCode(lang.id)}
                    className="w-full px-4 py-2 text-left text-sm text-aki-text hover:bg-aki-border transition-colors flex items-center gap-2"
                  >
                    <span className="text-base">{lang.icon}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Section tabs with Save button */}
      <div className="flex items-center border-b border-aki-border shrink-0">
        <div className="flex flex-1">
          {[
            { id: 'params', label: 'Params', count: request.params.filter(p => p.enabled).length },
            { id: 'headers', label: 'Headers', count: request.headers.filter(h => h.enabled).length },
            { id: 'body', label: 'Body' },
            { id: 'auth', label: 'Auth' },
          ].map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSection === section.id
                  ? 'border-aki-accent text-aki-accent'
                  : 'border-transparent text-aki-text-muted hover:text-aki-text'
              }`}
            >
              {section.label}
              {section.count !== undefined && section.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-aki-accent/20 text-aki-accent rounded">
                  {section.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-aki-text-muted hover:text-aki-text hover:bg-aki-border transition-colors flex items-center gap-1"
          title="Save Request"
        >
          <Save size={16} />
          Save
        </button>
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-hidden">
        {activeSection === 'params' && renderKeyValueTable('params')}
        {activeSection === 'headers' && renderKeyValueTable('headers')}
        {activeSection === 'body' && renderBody()}
        {activeSection === 'auth' && renderAuth()}
      </div>

      {/* Batch Edit Modal */}
      {batchEditModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-aki-card border border-aki-border rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-aki-border">
              <h2 className="text-lg font-semibold">
                Bulk Edit {batchEditModal.field === 'headers' ? 'Headers' : 'Parameters'}
              </h2>
              <button
                onClick={() => setBatchEditModal({ open: false, field: null })}
                className="p-1 hover:bg-aki-border rounded"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-hidden flex flex-col">
              <p className="text-sm text-aki-text-muted mb-3">
                Edit {batchEditModal.field} in bulk. One per line in <code className="bg-aki-border px-1 rounded">key: value</code> format.
                Prefix with <code className="bg-aki-border px-1 rounded"># </code> to disable.
              </p>
              <textarea
                value={batchEditText}
                onChange={(e) => setBatchEditText(e.target.value)}
                className="flex-1 w-full min-h-[300px] bg-aki-bg border border-aki-border rounded p-3 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-aki-accent"
                placeholder={`Content-Type: application/json\nAuthorization: Bearer token\n# X-Disabled-Header: value`}
              />
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-aki-border">
              <button
                onClick={() => setBatchEditModal({ open: false, field: null })}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={applyBatchEdit}
                className="btn btn-primary"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code Generation Modal */}
      {codeModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-aki-bg border border-aki-border rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-aki-border">
              <h2 className="text-lg font-semibold text-aki-text flex items-center gap-2">
                <Terminal size={20} className="text-aki-accent" />
                Code Generation
              </h2>
              <button
                onClick={() => setCodeModal({ open: false, activeLanguage: 'curl', copied: false })}
                className="text-aki-text-muted hover:text-aki-text transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Language Tabs */}
            <div className="flex border-b border-aki-border overflow-x-auto">
              {[
                { id: 'curl', label: 'cURL' },
                { id: 'javascript', label: 'JavaScript' },
                { id: 'python', label: 'Python' },
                { id: 'java', label: 'Java' },
                { id: 'dotnet', label: '.NET Core' },
                { id: 'go', label: 'Go' },
                { id: 'rust', label: 'Rust' },
                { id: 'cpp', label: 'C++' },
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setCodeModal({ ...codeModal, activeLanguage: lang.id, copied: false })}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    codeModal.activeLanguage === lang.id
                      ? 'border-aki-accent text-aki-accent'
                      : 'border-transparent text-aki-text-muted hover:text-aki-text'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <div className="p-4 flex-1 overflow-hidden flex flex-col">
              <p className="text-sm text-aki-text-muted mb-3">
                {codeModal.activeLanguage === 'curl' && 'Copy and paste this cURL command into your terminal'}
                {codeModal.activeLanguage === 'javascript' && 'JavaScript code using native fetch API'}
                {codeModal.activeLanguage === 'python' && 'Python code using requests library (pip install requests)'}
                {codeModal.activeLanguage === 'java' && 'Java code using HttpClient (Java 11+)'}
                {codeModal.activeLanguage === 'dotnet' && '.NET Core code using HttpClient'}
                {codeModal.activeLanguage === 'go' && 'Go code using net/http package'}
                {codeModal.activeLanguage === 'rust' && 'Rust code using reqwest crate (cargo add reqwest tokio)'}
                {codeModal.activeLanguage === 'cpp' && 'C++ code using libcurl (requires libcurl library)'}
              </p>
              <div className="flex-1 bg-[#282c34] border border-aki-border rounded p-4 overflow-auto">
                <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-all">
                  {getCodeForLanguage(codeModal.activeLanguage)}
                </pre>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-aki-border">
              <button
                onClick={() => setCodeModal({ open: false, activeLanguage: 'curl', copied: false })}
                className="btn btn-secondary"
              >
                Close
              </button>
              <button
                onClick={handleCopyCode}
                className="btn btn-primary flex items-center gap-2"
              >
                {codeModal.copied ? (
                  <>
                    <Check size={16} /> Copied!
                  </>
                ) : (
                  <>
                    <FileText size={16} /> Copy to Clipboard
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

