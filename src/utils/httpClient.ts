import { ApiRequest, ApiResponse, KeyValue, RequestAuth } from '../types';
import { replaceVariables } from './helpers';

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

  // Add query parameters
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
    console.log('[HTTP Client] Bearer token after variable replacement:', token ? `"${token}"` : '<empty>');
    // Only add Authorization header if token is not empty
    if (token && token.trim()) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[HTTP Client] Authorization header set:', headers['Authorization']);
    } else {
      console.warn('[HTTP Client] Bearer token is empty or whitespace only, skipping Authorization header');
    }
  } else if (effectiveAuth.type === 'basic' && effectiveAuth.basic) {
    const username = replaceVariables(effectiveAuth.basic.username, collectionVariables, environmentVariables);
    const password = replaceVariables(effectiveAuth.basic.password, collectionVariables, environmentVariables);
    console.log('[HTTP Client] Basic auth username after variable replacement:', username ? `"${username}"` : '<empty>');
    // Only add Authorization header if username is not empty
    if (username && username.trim()) {
      const credentials = btoa(`${username}:${password}`);
      headers['Authorization'] = `Basic ${credentials}`;
      console.log('[HTTP Client] Authorization header set for Basic auth');
    } else {
      console.warn('[HTTP Client] Basic auth username is empty, skipping Authorization header');
    }
  } else if (effectiveAuth.type === 'api-key' && effectiveAuth.apiKey?.addTo === 'header') {
    const key = replaceVariables(effectiveAuth.apiKey.key, collectionVariables, environmentVariables);
    const value = replaceVariables(effectiveAuth.apiKey.value, collectionVariables, environmentVariables);
    console.log('[HTTP Client] API Key header:', key ? `"${key}"` : '<empty>', '=', value ? `"${value}"` : '<empty>');
    // Only add header if both key and value are not empty
    if (key && key.trim() && value && value.trim()) {
      headers[key] = value;
      console.log('[HTTP Client] API Key header added');
    } else {
      console.warn('[HTTP Client] API Key header key or value is empty, skipping');
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

  try {
    // Use Electron's main process for HTTP requests (bypasses CORS)
    if (window.electronAPI?.httpRequest && !(body instanceof FormData)) {
      const response = await window.electronAPI.httpRequest({
        url,
        method: request.method,
        headers,
        body: body as string | undefined,
      });

      return response;
    }

    // Fallback to fetch for web or when FormData is used
    console.log('[HTTP Client] Using fetch API in browser mode');
    console.log('[HTTP Client] Request URL:', url);
    console.log('[HTTP Client] Request Method:', request.method);
    console.log('[HTTP Client] Request Headers:', JSON.stringify(headers, null, 2));
    console.log('[HTTP Client] Has Authorization header:', 'Authorization' in headers);

    const response = await fetch(url, {
      method: request.method,
      headers,
      body,
    });

    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    // Get response body
    const responseText = await response.text();

    // Get response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseText,
      time: responseTime,
      size: new Blob([responseText]).size,
    };
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

