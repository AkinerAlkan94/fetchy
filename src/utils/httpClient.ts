import { ApiRequest, ApiResponse, KeyValue, RequestAuth } from '../types';
import { replaceVariables } from './helpers';
import { useAppStore } from '../store/appStore';

// Check at runtime whether we're in Electron (preload may not be ready at module load time)
function checkIsElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
}

// ElectronAPI type is declared in ../types/index.ts

interface ExecuteRequestOptions {
  request: ApiRequest;
  collectionVariables?: KeyValue[];
  environmentVariables?: KeyValue[];
  inheritedAuth?: RequestAuth | null;
}

export const executeRequest = async ({
  request,
  collectionVariables = [],
  environmentVariables = [],
  inheritedAuth = null,
}: ExecuteRequestOptions): Promise<ApiResponse> => {
  const startTime = performance.now();

  // Determine effective auth (use inherited if type is 'inherit')
  const effectiveAuth = request.auth.type === 'inherit' && inheritedAuth
    ? inheritedAuth
    : request.auth;

  // Process URL with variables (env vars take precedence over collection vars)
  let url = replaceVariables(request.url, collectionVariables, environmentVariables);

  // Strip any inline query params from the URL (they are already synced to request.params)
  const qIndex = url.indexOf('?');
  if (qIndex >= 0) {
    url = url.substring(0, qIndex);
  }

  // Add query parameters from Params tab
  const enabledParams = request.params.filter(p => p.enabled && p.key);
  if (enabledParams.length > 0) {
    const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
    enabledParams.forEach(p => {
      const value = replaceVariables(p.value, collectionVariables, environmentVariables);
      urlObj.searchParams.append(p.key, value);
    });
    url = urlObj.toString();
  }

  // Add API key to query if configured
  if (effectiveAuth.type === 'api-key' && effectiveAuth.apiKey?.addTo === 'query') {
    const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
    const key = replaceVariables(effectiveAuth.apiKey.key, collectionVariables, environmentVariables);
    const value = replaceVariables(effectiveAuth.apiKey.value, collectionVariables, environmentVariables);
    // Only add query parameter if both key and value are not empty
    if (key && key.trim() && value && value.trim()) {
      urlObj.searchParams.append(key, value);
      url = urlObj.toString();
    }
  }

  // Build headers
  const headers: Record<string, string> = {};

  // Add request headers
  for (const header of request.headers) {
    if (header.enabled && header.key && header.key.trim()) {
      const headerValue = replaceVariables(header.value, collectionVariables, environmentVariables);
      // Allow empty values for headers (some headers can be empty), but trim the key
      headers[header.key.trim()] = headerValue;
    }
  }

  // Add auth headers
  if (effectiveAuth.type === 'bearer' && effectiveAuth.bearer) {
    const token = replaceVariables(effectiveAuth.bearer.token, collectionVariables, environmentVariables);
    if (token && token.trim()) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } else if (effectiveAuth.type === 'basic' && effectiveAuth.basic) {
    const username = replaceVariables(effectiveAuth.basic.username, collectionVariables, environmentVariables);
    const password = replaceVariables(effectiveAuth.basic.password, collectionVariables, environmentVariables);
    if (username && username.trim()) {
      const credentials = btoa(`${username}:${password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }
  } else if (effectiveAuth.type === 'api-key' && effectiveAuth.apiKey?.addTo === 'header') {
    const key = replaceVariables(effectiveAuth.apiKey.key, collectionVariables, environmentVariables);
    const value = replaceVariables(effectiveAuth.apiKey.value, collectionVariables, environmentVariables);
    if (key && key.trim() && value && value.trim()) {
      headers[key] = value;
    }
  }

  // Build body
  let body: string | FormData | undefined;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    switch (request.body.type) {
      case 'json':
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        body = replaceVariables(request.body.raw || '', collectionVariables, environmentVariables);
        break;
      case 'raw':
        body = replaceVariables(request.body.raw || '', collectionVariables, environmentVariables);
        break;
      case 'x-www-form-urlencoded': {
        headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
        const params = new URLSearchParams();
        for (const item of request.body.urlencoded || []) {
          if (item.enabled && item.key) {
            params.append(item.key, replaceVariables(item.value, collectionVariables, environmentVariables));
          }
        }
        body = params.toString();
        break;
      }
      case 'form-data': {
        const formData = new FormData();
        for (const item of request.body.formData || []) {
          if (item.enabled && item.key) {
            formData.append(item.key, replaceVariables(item.value, collectionVariables, environmentVariables));
          }
        }
        body = formData;
        // Don't set Content-Type for FormData, let the browser set it with boundary
        delete headers['Content-Type'];
        break;
      }
    }
  }

  const { updateTab, activeTabId } = useAppStore.getState();
  if (activeTabId) {
    updateTab(activeTabId, { scriptExecutionStatus: 'none' });
  }

  // Run pre-script if present. If it errors, abort the request.
  let preScriptOutput: string | undefined;
  if (request.preScript) {
    try {
      const preScriptResult = runPreScript(request.preScript, environmentVariables);
      // Return early with error response if pre-script failed
      if (preScriptResult.error) {
        return {
          status: 0,
          statusText: 'Pre-Script Error',
          headers: {},
          body: '',
          time: 0,
          size: 0,
          preScriptError: preScriptResult.error,
          preScriptOutput: preScriptResult.output || undefined,
        };
      }
      // Pre-script succeeded — store output for Console
      preScriptOutput = preScriptResult.output;
    } catch (e: any) {
      return {
        status: 0,
        statusText: 'Pre-Script Error',
        headers: {},
        body: '',
        time: 0,
        size: 0,
        preScriptError: e.message,
      };
    }
  }

  try {
    // If in Electron, use the main process for HTTP requests to bypass CORS.
    if (checkIsElectron()) {
      const response = await window.electronAPI.httpRequest({
        url,
        method: request.method,
        headers,
        body: body,
      });

      if (request.script) {
        try {
          await runScript(request.script, response, environmentVariables);
          if (useAppStore.getState().activeTabId) {
            useAppStore.getState().updateTab(useAppStore.getState().activeTabId!, { scriptExecutionStatus: 'success' });
          }
        } catch (e: any) {
          response.scriptError = e.message;
          if (useAppStore.getState().activeTabId) {
            useAppStore.getState().updateTab(useAppStore.getState().activeTabId!, { scriptExecutionStatus: 'error' });
          }
        }
      }
      // Attach pre-script output if any
      if (preScriptOutput) response.preScriptOutput = preScriptOutput;
      return response;
    }

    // Browser mode: use local CORS proxy
    const proxyResponse = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method: request.method,
        headers,
        body: body as string | undefined,
      }),
    });

    const apiResponse: ApiResponse = await proxyResponse.json();

    // Run post-script if present
    if (request.script) {
      try {
        await runScript(request.script, apiResponse, environmentVariables);
        if (useAppStore.getState().activeTabId) {
          useAppStore.getState().updateTab(useAppStore.getState().activeTabId!, { scriptExecutionStatus: 'success' });
        }
      } catch (e: any) {
        apiResponse.scriptError = e.message;
        if (useAppStore.getState().activeTabId) {
          useAppStore.getState().updateTab(useAppStore.getState().activeTabId!, { scriptExecutionStatus: 'error' });
        }
      }
    }
    // Attach pre-script output if any
    if (preScriptOutput) apiResponse.preScriptOutput = preScriptOutput;

    return apiResponse;
  } catch (error) {
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      status: 0,
      statusText: 'Error',
      headers: {},
      body: JSON.stringify({ error: errorMessage }),
      time: responseTime,
      size: 0,
    };
  }
};

const runScript = async (script: string, response: ApiResponse, environment: KeyValue[]) => {
  const fetchy = {
    response: {
      data: JSON.parse(response.body),
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    },
    environment: {
      get: (key: string) => {
        const variable = environment.find(v => v.key === key);
        return variable ? variable.value : undefined;
      },
      set: (key: string, value: any) => {
        const { updateEnvironment, getActiveEnvironment } = useAppStore.getState();
        const activeEnvironment = getActiveEnvironment();
        if (activeEnvironment) {
          const existingVarIndex = activeEnvironment.variables.findIndex(v => v.key === key);
          if (existingVarIndex > -1) {
            const newVariables = [...activeEnvironment.variables];
            newVariables[existingVarIndex] = { ...newVariables[existingVarIndex], value: String(value) };
            updateEnvironment(activeEnvironment.id, { variables: newVariables });
          } else {
            const newVar: KeyValue = { id: '', key, value: String(value), enabled: true };
            updateEnvironment(activeEnvironment.id, { variables: [...activeEnvironment.variables, newVar] });
          }
        }
      },
      all: () => environment,
    },
  };

  // Capture console.log output
  const logs: string[] = [];
  const fetchy_with_console = {
    ...fetchy,
    console: {
      log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
    },
  };

  const fn = new Function('fetchy', 'console', script);
  fn(fetchy_with_console, fetchy_with_console.console);

  if (logs.length > 0) {
    response.scriptOutput = logs.join('\n');
  }
};

const runPreScript = (script: string, environment: KeyValue[]): { error?: string; output?: string } => {
  const logs: string[] = [];
  const fetchy = {
    environment: {
      get: (key: string) => {
        const variable = environment.find(v => v.key === key);
        return variable ? variable.value : undefined;
      },
      set: (key: string, value: any) => {
        const { updateEnvironment, getActiveEnvironment } = useAppStore.getState();
        const activeEnvironment = getActiveEnvironment();
        if (activeEnvironment) {
          const existingVarIndex = activeEnvironment.variables.findIndex(v => v.key === key);
          if (existingVarIndex > -1) {
            const newVariables = [...activeEnvironment.variables];
            newVariables[existingVarIndex] = { ...newVariables[existingVarIndex], value: String(value) };
            updateEnvironment(activeEnvironment.id, { variables: newVariables });
          } else {
            const newVar: KeyValue = { id: '', key, value: String(value), enabled: true };
            updateEnvironment(activeEnvironment.id, { variables: [...activeEnvironment.variables, newVar] });
          }
        }
      },
      all: () => environment,
    },
    console: {
      log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
    },
  };

  try {
    const fn = new Function('fetchy', 'console', script);
    fn(fetchy, fetchy.console);
    return { output: logs.length > 0 ? logs.join('\n') : undefined };
  } catch (e: any) {
    return { error: e.message, output: logs.length > 0 ? logs.join('\n') : undefined };
  }
};

