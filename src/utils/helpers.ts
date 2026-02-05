import { v4 as uuidv4 } from 'uuid';
import * as yaml from 'js-yaml';
import {
  Collection,
  ApiRequest,
  RequestFolder,
  KeyValue,
  HttpMethod,
  OpenAPISpec,
  OpenAPIOperation,
  OpenAPIParameter,
  PostmanCollection,
  PostmanItem,
  PostmanRequest,
  PostmanUrl,
} from '../types';

// Helper to parse Postman URL
const parsePostmanUrl = (url: PostmanUrl | string): { url: string; params: KeyValue[] } => {
  if (typeof url === 'string') {
    return { url, params: [] };
  }

  const params: KeyValue[] = (url.query || []).map(q => ({
    id: uuidv4(),
    key: q.key,
    value: q.value,
    enabled: !q.disabled,
    description: q.description,
  }));

  return { url: url.raw, params };
};

// Helper to convert Postman auth
const convertPostmanAuth = (auth?: PostmanRequest['auth']): ApiRequest['auth'] => {
  if (!auth) return { type: 'none' };

  switch (auth.type) {
    case 'basic': {
      const username = auth.basic?.find(b => b.key === 'username')?.value || '';
      const password = auth.basic?.find(b => b.key === 'password')?.value || '';
      return { type: 'basic', basic: { username, password } };
    }
    case 'bearer': {
      const token = auth.bearer?.find(b => b.key === 'token')?.value || '';
      return { type: 'bearer', bearer: { token } };
    }
    case 'apikey': {
      const key = auth.apikey?.find(b => b.key === 'key')?.value || '';
      const value = auth.apikey?.find(b => b.key === 'value')?.value || '';
      const addTo = auth.apikey?.find(b => b.key === 'in')?.value === 'query' ? 'query' : 'header';
      return { type: 'api-key', apiKey: { key, value, addTo } };
    }
    default:
      return { type: 'none' };
  }
};

// Convert Postman request to our format
const convertPostmanRequest = (item: PostmanItem): ApiRequest | null => {
  if (!item.request) return null;

  const request = item.request;
  const { url, params } = parsePostmanUrl(request.url);

  const headers: KeyValue[] = (request.header || []).map(h => ({
    id: uuidv4(),
    key: h.key,
    value: h.value,
    enabled: !h.disabled,
    description: h.description,
  }));

  let body: ApiRequest['body'] = { type: 'none' };

  if (request.body) {
    switch (request.body.mode) {
      case 'raw':
        body = {
          type: request.body.options?.raw?.language === 'json' ? 'json' : 'raw',
          raw: request.body.raw || '',
        };
        break;
      case 'urlencoded':
        body = {
          type: 'x-www-form-urlencoded',
          urlencoded: (request.body.urlencoded || []).map(u => ({
            id: uuidv4(),
            key: u.key,
            value: u.value,
            enabled: !u.disabled,
            description: u.description,
          })),
        };
        break;
      case 'formdata':
        body = {
          type: 'form-data',
          formData: (request.body.formdata || []).map(f => ({
            id: uuidv4(),
            key: f.key,
            value: f.value,
            enabled: !f.disabled,
            description: f.description,
          })),
        };
        break;
    }
  }

  return {
    id: uuidv4(),
    name: item.name,
    method: (request.method?.toUpperCase() || 'GET') as HttpMethod,
    url,
    headers,
    params,
    body,
    auth: convertPostmanAuth(request.auth),
  };
};

// Recursively convert Postman items to folders/requests
const convertPostmanItems = (items: PostmanItem[]): { folders: RequestFolder[]; requests: ApiRequest[] } => {
  const folders: RequestFolder[] = [];
  const requests: ApiRequest[] = [];

  for (const item of items) {
    if (item.item) {
      // It's a folder
      const subResult = convertPostmanItems(item.item);
      folders.push({
        id: uuidv4(),
        name: item.name,
        description: item.description,
        folders: subResult.folders,
        requests: subResult.requests,
        expanded: true,
      });
    } else if (item.request) {
      // It's a request
      const request = convertPostmanRequest(item);
      if (request) {
        requests.push(request);
      }
    }
  }

  return { folders, requests };
};

// Import Postman collection
export const importPostmanCollection = (content: string): Collection | null => {
  try {
    // Trim whitespace from content
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      throw new Error('Empty content provided');
    }

    const postman: PostmanCollection = JSON.parse(trimmedContent);

    if (!postman || typeof postman !== 'object') {
      throw new Error('Invalid Postman collection: parsed content is not an object');
    }

    if (!postman.info) {
      throw new Error('Invalid Postman collection format: missing "info" field');
    }

    if (!postman.item) {
      throw new Error('Invalid Postman collection format: missing "item" field');
    }

    const { folders, requests } = convertPostmanItems(postman.item);

    const variables: KeyValue[] = (postman.variable || []).map(v => ({
      id: uuidv4(),
      key: v.key,
      value: v.value,
      enabled: !v.disabled,
    }));

    return {
      id: uuidv4(),
      name: postman.info.name,
      description: postman.info.description,
      folders,
      requests,
      variables,
      expanded: true,
    };
  } catch (error) {
    console.error('Error importing Postman collection:', error);
    throw error; // Re-throw to provide better error messages to the user
  }
};

// Convert OpenAPI parameter to KeyValue
const convertOpenAPIParameter = (param: OpenAPIParameter): KeyValue => ({
  id: uuidv4(),
  key: param.name,
  value: '',
  enabled: param.required || false,
  description: param.description,
});

// Convert OpenAPI operation to request
const convertOpenAPIOperation = (
  path: string,
  method: string,
  operation: OpenAPIOperation,
  baseUrl: string
): ApiRequest => {
  const headers: KeyValue[] = [];
  const params: KeyValue[] = [];

  if (operation.parameters) {
    for (const param of operation.parameters) {
      const kv = convertOpenAPIParameter(param);
      if (param.in === 'header') {
        headers.push(kv);
      } else if (param.in === 'query') {
        params.push(kv);
      }
    }
  }

  let body: ApiRequest['body'] = { type: 'none' };

  if (operation.requestBody?.content) {
    const contentTypes = Object.keys(operation.requestBody.content);
    if (contentTypes.includes('application/json')) {
      body = { type: 'json', raw: '{}' };
      headers.push({
        id: uuidv4(),
        key: 'Content-Type',
        value: 'application/json',
        enabled: true,
      });
    } else if (contentTypes.includes('application/x-www-form-urlencoded')) {
      body = { type: 'x-www-form-urlencoded', urlencoded: [] };
    } else if (contentTypes.includes('multipart/form-data')) {
      body = { type: 'form-data', formData: [] };
    }
  }

  // Replace path parameters with placeholders
  const processedPath = path.replace(/{(\w+)}/g, '<<$1>>');

  return {
    id: uuidv4(),
    name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
    method: method.toUpperCase() as HttpMethod,
    url: `${baseUrl}${processedPath}`,
    headers,
    params,
    body,
    auth: { type: 'none' },
  };
};

// Import OpenAPI specification
export const importOpenAPISpec = (content: string): Collection | null => {
  try {
    // Trim whitespace from content
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      throw new Error('Empty content provided');
    }

    let spec: OpenAPISpec;
    let parseError: Error | null = null;

    // Try to parse as JSON first, then YAML
    try {
      spec = JSON.parse(trimmedContent);
    } catch (jsonError) {
      parseError = jsonError as Error;
      try {
        const parsed = yaml.load(trimmedContent);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('YAML parsing returned invalid data');
        }
        spec = parsed as OpenAPISpec;
      } catch (yamlError) {
        throw new Error(`Failed to parse as JSON or YAML. JSON error: ${parseError.message}`);
      }
    }

    // Validate required fields
    if (!spec || typeof spec !== 'object') {
      throw new Error('Invalid OpenAPI specification: parsed content is not an object');
    }

    if (!spec.info) {
      throw new Error('Invalid OpenAPI specification: missing "info" field');
    }

    if (!spec.paths) {
      throw new Error('Invalid OpenAPI specification: no paths found');
    }

    if (typeof spec.paths !== 'object' || Object.keys(spec.paths).length === 0) {
      throw new Error('Invalid OpenAPI specification: paths object is empty');
    }

    const baseUrl = spec.servers?.[0]?.url || '';
    const folders: RequestFolder[] = [];

    // Group by tags if available
    const taggedRequests: Record<string, ApiRequest[]> = {};
    const untaggedRequests: ApiRequest[] = [];

    for (const [path, methods] of Object.entries(spec.paths)) {
      if (!methods || typeof methods !== 'object') continue;

      for (const [method, operation] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())) {
          const request = convertOpenAPIOperation(path, method, operation as OpenAPIOperation, baseUrl);

          const tags = (operation as OpenAPIOperation).tags;
          if (tags && tags.length > 0) {
            const tag = tags[0];
            if (!taggedRequests[tag]) {
              taggedRequests[tag] = [];
            }
            taggedRequests[tag].push(request);
          } else {
            untaggedRequests.push(request);
          }
        }
      }
    }

    // Create folders for each tag
    for (const [tag, reqs] of Object.entries(taggedRequests)) {
      folders.push({
        id: uuidv4(),
        name: tag,
        requests: reqs,
        folders: [],
        expanded: true,
      });
    }

    return {
      id: uuidv4(),
      name: spec.info.title || 'Imported API',
      description: spec.info.description,
      folders,
      requests: untaggedRequests,
      variables: [],
      expanded: true,
    };
  } catch (error) {
    console.error('Error importing OpenAPI spec:', error);
    throw error; // Re-throw to provide better error messages to the user
  }
};

// Export collection to Postman format
export const exportToPostman = (collection: Collection): string => {
  const convertRequest = (request: ApiRequest): PostmanItem => {
    const headers = request.headers.map(h => ({
      key: h.key,
      value: h.value,
      disabled: !h.enabled,
      description: h.description,
    }));

    let body: PostmanRequest['body'];
    switch (request.body.type) {
      case 'json':
      case 'raw':
        body = {
          mode: 'raw',
          raw: request.body.raw || '',
          options: request.body.type === 'json' ? { raw: { language: 'json' } } : undefined,
        };
        break;
      case 'x-www-form-urlencoded':
        body = {
          mode: 'urlencoded',
          urlencoded: (request.body.urlencoded || []).map(u => ({
            key: u.key,
            value: u.value,
            disabled: !u.enabled,
            description: u.description,
          })),
        };
        break;
      case 'form-data':
        body = {
          mode: 'formdata',
          formdata: (request.body.formData || []).map(f => ({
            key: f.key,
            value: f.value,
            disabled: !f.enabled,
            description: f.description,
          })),
        };
        break;
    }

    return {
      name: request.name,
      request: {
        method: request.method,
        header: headers,
        body,
        url: {
          raw: request.url,
          query: request.params.map(p => ({
            key: p.key,
            value: p.value,
            disabled: !p.enabled,
            description: p.description,
          })),
        },
      },
    };
  };

  const convertFolder = (folder: RequestFolder): PostmanItem => ({
    name: folder.name,
    description: folder.description,
    item: [
      ...folder.folders.map(convertFolder),
      ...folder.requests.map(convertRequest),
    ],
  });

  const postmanCollection: PostmanCollection = {
    info: {
      name: collection.name,
      description: collection.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [
      ...collection.folders.map(convertFolder),
      ...collection.requests.map(convertRequest),
    ],
    variable: collection.variables?.map(v => ({
      key: v.key,
      value: v.value,
      disabled: !v.enabled,
    })),
  };

  return JSON.stringify(postmanCollection, null, 2);
};

// Replace environment variables in string
export const replaceVariables = (
  text: string,
  variables: KeyValue[],
  envVariables: KeyValue[]
): string => {
  let result = text;

  // Combine all variables, env variables take precedence
  const allVariables = [...variables, ...envVariables];

  for (const variable of allVariables) {
    if (variable.enabled) {
      const regex = new RegExp(`<<${variable.key}>>`, 'g');
      result = result.replace(regex, variable.value);
    }
  }

  return result;
};

// Resolve all variables in a request object (for saving to history with actual values)
// Secret variables are NOT resolved - they remain as <<variableName>> placeholders
export const resolveRequestVariables = (
  request: ApiRequest,
  collectionVariables: KeyValue[],
  environmentVariables: KeyValue[]
): ApiRequest => {
  // Filter out secret variables - they should not be resolved for history
  const nonSecretVariables = [...collectionVariables, ...environmentVariables].filter(v => !v.isSecret);

  // Helper to replace in a string (only non-secret variables)
  const resolve = (text: string): string => replaceVariables(text, nonSecretVariables, []);

  // Deep clone the request to avoid mutating the original
  const resolved: ApiRequest = {
    ...request,
    url: resolve(request.url),
    headers: request.headers.map(h => ({
      ...h,
      value: resolve(h.value),
    })),
    params: request.params.map(p => ({
      ...p,
      value: resolve(p.value),
    })),
    body: {
      ...request.body,
      raw: request.body.raw ? resolve(request.body.raw) : request.body.raw,
      formData: request.body.formData?.map(f => ({
        ...f,
        value: resolve(f.value),
      })),
      urlencoded: request.body.urlencoded?.map(u => ({
        ...u,
        value: resolve(u.value),
      })),
    },
    auth: {
      ...request.auth,
      bearer: request.auth.bearer ? {
        token: resolve(request.auth.bearer.token),
      } : request.auth.bearer,
      basic: request.auth.basic ? {
        username: resolve(request.auth.basic.username),
        password: resolve(request.auth.basic.password),
      } : request.auth.basic,
      apiKey: request.auth.apiKey ? {
        ...request.auth.apiKey,
        key: resolve(request.auth.apiKey.key),
        value: resolve(request.auth.apiKey.value),
      } : request.auth.apiKey,
    },
  };

  return resolved;
};

// Format bytes to human readable
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format milliseconds to human readable
export const formatTime = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

// Parse cURL command and convert to ApiRequest
export const parseCurlCommand = (curlCommand: string): ApiRequest | null => {
  try {
    // Normalize the cURL command: handle line continuations and multiple spaces
    let normalizedCmd = curlCommand
      .replace(/\\\r?\n/g, ' ')  // Handle line continuations
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .trim();

    // Validate that this is a curl command
    if (!normalizedCmd.toLowerCase().startsWith('curl ')) {
      throw new Error('Not a valid cURL command');
    }

    // Remove 'curl ' prefix
    normalizedCmd = normalizedCmd.substring(5).trim();

    // Initialize request parts
    let method: HttpMethod = 'GET';
    let methodExplicitlySet = false;
    let url = '';
    const headers: KeyValue[] = [];
    let body: ApiRequest['body'] = { type: 'none' };
    let auth: ApiRequest['auth'] = { type: 'none' };
    let rawBodyData: string[] = []; // Collect multiple -d options

    // Helper to extract quoted strings
    const extractQuotedString = (str: string, startIndex: number): { value: string; endIndex: number } => {
      const quote = str[startIndex];
      let endIndex = startIndex + 1;
      let value = '';
      let escaped = false;

      while (endIndex < str.length) {
        const char = str[endIndex];
        if (escaped) {
          value += char;
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          return { value, endIndex: endIndex + 1 };
        } else {
          value += char;
        }
        endIndex++;
      }
      return { value, endIndex };
    };

    // Parse command into tokens
    const tokens: string[] = [];
    let i = 0;
    while (i < normalizedCmd.length) {
      // Skip whitespace
      while (i < normalizedCmd.length && normalizedCmd[i] === ' ') i++;
      if (i >= normalizedCmd.length) break;

      if (normalizedCmd[i] === '"' || normalizedCmd[i] === "'") {
        const { value, endIndex } = extractQuotedString(normalizedCmd, i);
        tokens.push(value);
        i = endIndex;
      } else {
        // Unquoted token
        let token = '';
        while (i < normalizedCmd.length && normalizedCmd[i] !== ' ') {
          token += normalizedCmd[i];
          i++;
        }
        tokens.push(token);
      }
    }


    // Process tokens
    i = 0;
    while (i < tokens.length) {
      const token = tokens[i];

      // Handle combined flags like -XPOST or -X POST
      if (token === '-X' || token === '--request') {
        // HTTP method
        i++;
        if (i < tokens.length) {
          method = tokens[i].toUpperCase() as HttpMethod;
          methodExplicitlySet = true;
        }
      } else if (token.startsWith('-X') && token.length > 2) {
        // Combined format like -XPOST
        method = token.substring(2).toUpperCase() as HttpMethod;
        methodExplicitlySet = true;
      } else if (token === '-H' || token === '--header') {
        // Header
        i++;
        if (i < tokens.length) {
          const headerStr = tokens[i];
          const colonIndex = headerStr.indexOf(':');
          if (colonIndex > 0) {
            const key = headerStr.substring(0, colonIndex).trim();
            const value = headerStr.substring(colonIndex + 1).trim();
            headers.push({
              id: uuidv4(),
              key,
              value,
              enabled: true,
            });
          }
        }
      } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary' || token === '--data-ascii') {
        // Request body - collect all -d options
        i++;
        if (i < tokens.length) {
          rawBodyData.push(tokens[i]);
        }
      } else if (token === '--data-urlencode') {
        // URL encoded data
        i++;
        if (i < tokens.length) {
          const data = tokens[i];
          if (body.type !== 'x-www-form-urlencoded') {
            body = { type: 'x-www-form-urlencoded', urlencoded: [] };
          }
          const eqIndex = data.indexOf('=');
          if (eqIndex > 0) {
            body.urlencoded = body.urlencoded || [];
            body.urlencoded.push({
              id: uuidv4(),
              key: data.substring(0, eqIndex),
              value: decodeURIComponent(data.substring(eqIndex + 1)),
              enabled: true,
            });
          }
        }
      } else if (token === '-F' || token === '--form') {
        // Form data
        i++;
        if (i < tokens.length) {
          const data = tokens[i];
          if (body.type !== 'form-data') {
            body = { type: 'form-data', formData: [] };
          }
          const eqIndex = data.indexOf('=');
          if (eqIndex > 0) {
            body.formData = body.formData || [];
            const key = data.substring(0, eqIndex);
            let value = data.substring(eqIndex + 1);
            // Handle file references (@filename)
            if (value.startsWith('@')) {
              value = `[File: ${value.substring(1)}]`;
            }
            body.formData.push({
              id: uuidv4(),
              key,
              value,
              enabled: true,
            });
          }
        }
      } else if (token === '-u' || token === '--user') {
        // Basic auth
        i++;
        if (i < tokens.length) {
          const credentials = tokens[i];
          const colonIndex = credentials.indexOf(':');
          if (colonIndex > 0) {
            auth = {
              type: 'basic',
              basic: {
                username: credentials.substring(0, colonIndex),
                password: credentials.substring(colonIndex + 1),
              },
            };
          } else {
            auth = {
              type: 'basic',
              basic: {
                username: credentials,
                password: '',
              },
            };
          }
        }
      } else if (token === '-b' || token === '--cookie') {
        // Cookies - add as Cookie header
        i++;
        if (i < tokens.length) {
          const cookieValue = tokens[i];
          // Check if it's a file reference
          if (!cookieValue.startsWith('@')) {
            headers.push({
              id: uuidv4(),
              key: 'Cookie',
              value: cookieValue,
              enabled: true,
            });
          }
        }
      } else if (token === '-A' || token === '--user-agent') {
        // User-Agent header
        i++;
        if (i < tokens.length) {
          headers.push({
            id: uuidv4(),
            key: 'User-Agent',
            value: tokens[i],
            enabled: true,
          });
        }
      } else if (token === '-e' || token === '--referer') {
        // Referer header
        i++;
        if (i < tokens.length) {
          headers.push({
            id: uuidv4(),
            key: 'Referer',
            value: tokens[i],
            enabled: true,
          });
        }
      } else if (token === '--compressed') {
        // Add Accept-Encoding header for compressed responses
        const hasAcceptEncoding = headers.some(h => h.key.toLowerCase() === 'accept-encoding');
        if (!hasAcceptEncoding) {
          headers.push({
            id: uuidv4(),
            key: 'Accept-Encoding',
            value: 'gzip, deflate, br',
            enabled: true,
          });
        }
      } else if (token === '-L' || token === '--location') {
        // Follow redirects - skip flag (usually handled by client)
      } else if (token === '-k' || token === '--insecure') {
        // Skip SSL verification - skip flag
      } else if (token === '-v' || token === '--verbose') {
        // Verbose mode - skip flag
      } else if (token === '-s' || token === '--silent') {
        // Silent mode - skip flag
      } else if (token === '-i' || token === '--include') {
        // Include headers in output - skip flag
      } else if (token.startsWith('-')) {
        // Skip unknown flags
        // Check if next token might be a value for this flag (not starting with - and not a URL)
        if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-') && !tokens[i + 1].startsWith('http')) {
          i++;
        }
      } else {
        // URL - can be with or without quotes
        if (!url && (token.startsWith('http://') || token.startsWith('https://') || token.includes('://'))) {
          url = token;
        } else if (!url && !token.startsWith('-')) {
          // Might be a URL without protocol - assume https
          url = token.includes('.') ? `https://${token}` : token;
        }
      }
      i++;
    }

    if (!url) {
      throw new Error('No URL found in cURL command');
    }

    // Find Content-Type header to determine body type
    const contentTypeHeader = headers.find(h => h.key.toLowerCase() === 'content-type');
    const contentType = contentTypeHeader?.value.toLowerCase() || '';

    // Process collected raw body data
    if (rawBodyData.length > 0) {
      const combinedData = rawBodyData.join('&');

      // Determine body type based on Content-Type header or data format
      if (contentType.includes('application/json') || contentType.includes('text/json')) {
        // JSON body
        try {
          // Try to parse and format JSON
          const parsed = JSON.parse(combinedData);
          body = { type: 'json', raw: JSON.stringify(parsed, null, 2) };
        } catch {
          body = { type: 'json', raw: combinedData };
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        // URL encoded form data
        body = { type: 'x-www-form-urlencoded', urlencoded: [] };
        const pairs = combinedData.split('&');
        for (const pair of pairs) {
          const eqIndex = pair.indexOf('=');
          if (eqIndex > 0) {
            body.urlencoded = body.urlencoded || [];
            body.urlencoded.push({
              id: uuidv4(),
              key: decodeURIComponent(pair.substring(0, eqIndex)),
              value: decodeURIComponent(pair.substring(eqIndex + 1)),
              enabled: true,
            });
          } else if (pair.trim()) {
            body.urlencoded = body.urlencoded || [];
            body.urlencoded.push({
              id: uuidv4(),
              key: decodeURIComponent(pair),
              value: '',
              enabled: true,
            });
          }
        }
      } else if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
        // XML body
        body = { type: 'raw', raw: combinedData };
      } else if (contentType.includes('text/plain')) {
        // Plain text body
        body = { type: 'raw', raw: combinedData };
      } else {
        // Try to auto-detect body type
        const trimmedData = combinedData.trim();

        // Check if it looks like JSON
        if ((trimmedData.startsWith('{') && trimmedData.endsWith('}')) ||
            (trimmedData.startsWith('[') && trimmedData.endsWith(']'))) {
          try {
            const parsed = JSON.parse(trimmedData);
            body = { type: 'json', raw: JSON.stringify(parsed, null, 2) };
          } catch {
            // Not valid JSON, check if it's form data
            if (trimmedData.includes('=') && !trimmedData.includes('\n')) {
              // Looks like form data
              body = { type: 'x-www-form-urlencoded', urlencoded: [] };
              const pairs = trimmedData.split('&');
              for (const pair of pairs) {
                const eqIndex = pair.indexOf('=');
                if (eqIndex > 0) {
                  body.urlencoded = body.urlencoded || [];
                  body.urlencoded.push({
                    id: uuidv4(),
                    key: decodeURIComponent(pair.substring(0, eqIndex)),
                    value: decodeURIComponent(pair.substring(eqIndex + 1)),
                    enabled: true,
                  });
                }
              }
            } else {
              body = { type: 'raw', raw: combinedData };
            }
          }
        } else if (trimmedData.includes('=') && !trimmedData.includes('\n') && !trimmedData.includes('<')) {
          // Looks like form data (key=value&key2=value2)
          body = { type: 'x-www-form-urlencoded', urlencoded: [] };
          const pairs = trimmedData.split('&');
          for (const pair of pairs) {
            const eqIndex = pair.indexOf('=');
            if (eqIndex > 0) {
              body.urlencoded = body.urlencoded || [];
              body.urlencoded.push({
                id: uuidv4(),
                key: decodeURIComponent(pair.substring(0, eqIndex)),
                value: decodeURIComponent(pair.substring(eqIndex + 1)),
                enabled: true,
              });
            }
          }
        } else {
          body = { type: 'raw', raw: combinedData };
        }
      }

      // Set method to POST if not explicitly set and we have body data
      if (!methodExplicitlySet) {
        method = 'POST';
      }
    }

    // Set method to POST if we have form data and method wasn't explicitly set
    if (!methodExplicitlySet && (body.type === 'form-data' || body.type === 'x-www-form-urlencoded')) {
      method = 'POST';
    }

    // Check for Bearer token in headers
    const authHeader = headers.find(h => h.key.toLowerCase() === 'authorization');
    if (authHeader && auth.type === 'none') {
      const value = authHeader.value;
      if (value.toLowerCase().startsWith('bearer ')) {
        auth = {
          type: 'bearer',
          bearer: {
            token: value.substring(7).trim(),
          },
        };
        // Remove the authorization header since we're using auth
        const authIndex = headers.indexOf(authHeader);
        if (authIndex > -1) {
          headers.splice(authIndex, 1);
        }
      } else if (value.toLowerCase().startsWith('basic ')) {
        // Basic auth from header
        try {
          const decoded = atob(value.substring(6).trim());
          const colonIndex = decoded.indexOf(':');
          auth = {
            type: 'basic',
            basic: {
              username: colonIndex > 0 ? decoded.substring(0, colonIndex) : decoded,
              password: colonIndex > 0 ? decoded.substring(colonIndex + 1) : '',
            },
          };
          const authIndex = headers.indexOf(authHeader);
          if (authIndex > -1) {
            headers.splice(authIndex, 1);
          }
        } catch {
          // Keep auth header if base64 decode fails
        }
      }
    }

    // Check for common API key headers
    const apiKeyHeaders = ['x-api-key', 'api-key', 'apikey', 'x-auth-token', 'x-access-token'];
    if (auth.type === 'none') {
      const apiKeyHeader = headers.find(h => apiKeyHeaders.includes(h.key.toLowerCase()));
      if (apiKeyHeader) {
        auth = {
          type: 'api-key',
          apiKey: {
            key: apiKeyHeader.key,
            value: apiKeyHeader.value,
            addTo: 'header',
          },
        };
        // Remove the api key header since we're using auth
        const apiKeyIndex = headers.indexOf(apiKeyHeader);
        if (apiKeyIndex > -1) {
          headers.splice(apiKeyIndex, 1);
        }
      }
    }

    // Parse URL to extract query params
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      // If URL parsing fails, try adding https://
      urlObj = new URL(`https://${url}`);
    }

    const params: KeyValue[] = [];
    urlObj.searchParams.forEach((value, key) => {
      params.push({
        id: uuidv4(),
        key,
        value,
        enabled: true,
      });
    });

    // Check for API key in query params
    if (auth.type === 'none') {
      const apiKeyParams = ['api_key', 'apikey', 'api-key', 'key', 'access_token', 'token'];
      const apiKeyParam = params.find(p => apiKeyParams.includes(p.key.toLowerCase()));
      if (apiKeyParam) {
        auth = {
          type: 'api-key',
          apiKey: {
            key: apiKeyParam.key,
            value: apiKeyParam.value,
            addTo: 'query',
          },
        };
        // Remove from params since we're using auth
        const paramIndex = params.indexOf(apiKeyParam);
        if (paramIndex > -1) {
          params.splice(paramIndex, 1);
        }
      }
    }

    // Generate a name from the URL
    const urlPath = urlObj.pathname || '/';
    const name = `${method} ${urlPath}`;

    return {
      id: uuidv4(),
      name,
      method,
      url: urlObj.origin + urlObj.pathname,
      headers,
      params,
      body,
      auth,
    };
  } catch (error) {
    console.error('Error parsing cURL command:', error);
    return null;
  }
};

// Get method color
export const getMethodColor = (method: HttpMethod): string => {
  const colors: Record<HttpMethod, string> = {
    GET: 'text-green-400',
    POST: 'text-yellow-400',
    PUT: 'text-blue-400',
    PATCH: 'text-purple-400',
    DELETE: 'text-red-400',
    HEAD: 'text-gray-400',
    OPTIONS: 'text-pink-400',
  };
  return colors[method] || 'text-gray-400';
};

// Get method background color
export const getMethodBgColor = (method: HttpMethod): string => {
  const colors: Record<HttpMethod, string> = {
    GET: 'method-get',
    POST: 'method-post',
    PUT: 'method-put',
    PATCH: 'method-patch',
    DELETE: 'method-delete',
    HEAD: 'method-head',
    OPTIONS: 'method-options',
  };
  return colors[method] || 'method-head';
};

// Get status color
export const getStatusColor = (status: number): string => {
  if (status >= 200 && status < 300) return 'text-green-400';
  if (status >= 300 && status < 400) return 'text-blue-400';
  if (status >= 400 && status < 500) return 'text-yellow-400';
  if (status >= 500) return 'text-red-400';
  return 'text-gray-400';
};

// Pretty print JSON
export const prettyPrintJson = (json: string): string => {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
};

// Validate JSON
export const isValidJson = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

// Generate cURL command from request
export const generateCurl = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = replaceVariables(request.url, variables, []);
  let curl = `curl -X ${request.method} '${url}'`;

  // Add headers
  for (const header of request.headers) {
    if (header.enabled) {
      const value = replaceVariables(header.value, variables, []);
      curl += ` \\\n  -H '${header.key}: ${value}'`;
    }
  }

  // Add auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    const token = replaceVariables(request.auth.bearer.token, variables, []);
    curl += ` \\\n  -H 'Authorization: Bearer ${token}'`;
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
    curl += ` \\\n  -H 'Authorization: Basic ${credentials}'`;
  } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
    const value = replaceVariables(request.auth.apiKey.value, variables, []);
    curl += ` \\\n  -H '${request.auth.apiKey.key}: ${value}'`;
  }

  // Add body
  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      const body = replaceVariables(request.body.raw, variables, []);
      curl += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`;
    }
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
    const data = request.body.urlencoded
      .filter(u => u.enabled)
      .map(u => `${encodeURIComponent(u.key)}=${encodeURIComponent(replaceVariables(u.value, variables, []))}`)
      .join('&');
    curl += ` \\\n  -d '${data}'`;
  }

  return curl;
};

// Generate JavaScript fetch code from request
export const generateJavaScript = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = replaceVariables(request.url, variables, []);
  let code = `fetch('${url}', {\n  method: '${request.method}'`;

  // Add headers
  const headers: Record<string, string> = {};
  for (const header of request.headers) {
    if (header.enabled) {
      const value = replaceVariables(header.value, variables, []);
      headers[header.key] = value;
    }
  }

  // Add auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    const token = replaceVariables(request.auth.bearer.token, variables, []);
    headers['Authorization'] = `Bearer ${token}`;
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
    headers['Authorization'] = `Basic ${credentials}`;
  } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
    const value = replaceVariables(request.auth.apiKey.value, variables, []);
    headers[request.auth.apiKey.key] = value;
  }

  if (Object.keys(headers).length > 0) {
    code += `,\n  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, '\n  ')}`;
  }

  // Add body
  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      const body = replaceVariables(request.body.raw, variables, []);
      code += `,\n  body: ${body}`;
    }
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
    const params = request.body.urlencoded
      .filter(u => u.enabled)
      .map(u => `${encodeURIComponent(u.key)}=${encodeURIComponent(replaceVariables(u.value, variables, []))}`)
      .join('&');
    code += `,\n  body: '${params}'`;
  }

  code += `\n})\n  .then(response => response.json())\n  .then(data => console.log(data))\n  .catch(error => console.error('Error:', error));`;
  return code;
};

// Generate Python requests code from request
export const generatePython = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = replaceVariables(request.url, variables, []);
  let code = `import requests\n\n`;

  code += `url = '${url}'\n`;

  // Add headers
  const headers: string[] = [];
  for (const header of request.headers) {
    if (header.enabled) {
      const value = replaceVariables(header.value, variables, []);
      headers.push(`    '${header.key}': '${value}'`);
    }
  }

  // Add auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    const token = replaceVariables(request.auth.bearer.token, variables, []);
    headers.push(`    'Authorization': 'Bearer ${token}'`);
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
    headers.push(`    'Authorization': 'Basic ${credentials}'`);
  } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
    const value = replaceVariables(request.auth.apiKey.value, variables, []);
    headers.push(`    '${request.auth.apiKey.key}': '${value}'`);
  }

  if (headers.length > 0) {
    code += `headers = {\n${headers.join(',\n')}\n}\n`;
  }

  // Add body
  let bodyParam = '';
  if (request.body.type === 'json' && request.body.raw) {
    const body = replaceVariables(request.body.raw, variables, []);
    bodyParam = `, json=${body}`;
  } else if (request.body.type === 'raw' && request.body.raw) {
    const body = replaceVariables(request.body.raw, variables, []);
    bodyParam = `, data='${body.replace(/'/g, "\\'")}'`;
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
    const data = request.body.urlencoded
      .filter(u => u.enabled)
      .map(u => `    '${u.key}': '${replaceVariables(u.value, variables, [])}'`)
      .join(',\n');
    code += `data = {\n${data}\n}\n`;
    bodyParam = ', data=data';
  }

  const headersParam = headers.length > 0 ? ', headers=headers' : '';
  code += `\nresponse = requests.${request.method.toLowerCase()}(url${headersParam}${bodyParam})\n`;
  code += `print(response.json())`;

  return code;
};

// Generate Java HttpClient code from request
export const generateJava = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = replaceVariables(request.url, variables, []);
  let code = `import java.net.http.HttpClient;\nimport java.net.http.HttpRequest;\nimport java.net.http.HttpResponse;\nimport java.net.URI;\n\n`;

  code += `public class ApiRequest {\n`;
  code += `    public static void main(String[] args) throws Exception {\n`;
  code += `        HttpClient client = HttpClient.newHttpClient();\n\n`;
  code += `        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()\n`;
  code += `            .uri(URI.create("${url}"))\n`;
  code += `            .method("${request.method}", `;

  // Add body
  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      const body = replaceVariables(request.body.raw, variables, []);
      code += `HttpRequest.BodyPublishers.ofString(${JSON.stringify(body)}))`;
    } else {
      code += `HttpRequest.BodyPublishers.noBody())`;
    }
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
    const data = request.body.urlencoded
      .filter(u => u.enabled)
      .map(u => `${encodeURIComponent(u.key)}=${encodeURIComponent(replaceVariables(u.value, variables, []))}`)
      .join('&');
    code += `HttpRequest.BodyPublishers.ofString("${data}"))`;
  } else {
    code += `HttpRequest.BodyPublishers.noBody())`;
  }

  // Add headers
  for (const header of request.headers) {
    if (header.enabled) {
      const value = replaceVariables(header.value, variables, []);
      code += `\n            .header("${header.key}", "${value}")`;
    }
  }

  // Add auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    const token = replaceVariables(request.auth.bearer.token, variables, []);
    code += `\n            .header("Authorization", "Bearer ${token}")`;
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
    code += `\n            .header("Authorization", "Basic ${credentials}")`;
  } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
    const value = replaceVariables(request.auth.apiKey.value, variables, []);
    code += `\n            .header("${request.auth.apiKey.key}", "${value}")`;
  }

  code += `;\n\n`;
  code += `        HttpRequest request = requestBuilder.build();\n`;
  code += `        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\n\n`;
  code += `        System.out.println(response.body());\n`;
  code += `    }\n`;
  code += `}\n`;

  return code;
};

// Generate .NET Core HttpClient code from request
export const generateDotNet = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = replaceVariables(request.url, variables, []);
  let code = `using System;\nusing System.Net.Http;\nusing System.Text;\nusing System.Threading.Tasks;\n\n`;

  code += `class Program\n{\n`;
  code += `    static async Task Main(string[] args)\n    {\n`;
  code += `        using var client = new HttpClient();\n\n`;

  // Add headers
  for (const header of request.headers) {
    if (header.enabled) {
      const value = replaceVariables(header.value, variables, []);
      code += `        client.DefaultRequestHeaders.Add("${header.key}", "${value}");\n`;
    }
  }

  // Add auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    const token = replaceVariables(request.auth.bearer.token, variables, []);
    code += `        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "${token}");\n`;
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
    code += `        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", "${credentials}");\n`;
  } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
    const value = replaceVariables(request.auth.apiKey.value, variables, []);
    code += `        client.DefaultRequestHeaders.Add("${request.auth.apiKey.key}", "${value}");\n`;
  }

  code += `\n`;

  // Add body and request
  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      const body = replaceVariables(request.body.raw, variables, []);
      code += `        var content = new StringContent(${JSON.stringify(body)}, Encoding.UTF8, "application/json");\n`;
      code += `        var response = await client.${request.method.charAt(0) + request.method.slice(1).toLowerCase()}Async("${url}", content);\n`;
    } else {
      code += `        var response = await client.${request.method.charAt(0) + request.method.slice(1).toLowerCase()}Async("${url}");\n`;
    }
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
    const data = request.body.urlencoded
      .filter(u => u.enabled)
      .map(u => `            {"${u.key}", "${replaceVariables(u.value, variables, [])}"}`)
      .join(',\n');
    code += `        var content = new FormUrlEncodedContent(new[]\n        {\n${data}\n        });\n`;
    code += `        var response = await client.${request.method.charAt(0) + request.method.slice(1).toLowerCase()}Async("${url}", content);\n`;
  } else {
    code += `        var response = await client.${request.method.charAt(0) + request.method.slice(1).toLowerCase()}Async("${url}");\n`;
  }

  code += `        var responseBody = await response.Content.ReadAsStringAsync();\n`;
  code += `        Console.WriteLine(responseBody);\n`;
  code += `    }\n`;
  code += `}\n`;

  return code;
};

// Generate Go net/http code from request
export const generateGo = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = replaceVariables(request.url, variables, []);
  let code = `package main\n\nimport (\n    "bytes"\n    "fmt"\n    "io"\n    "net/http"\n)\n\n`;

  code += `func main() {\n`;

  // Add body
  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      const body = replaceVariables(request.body.raw, variables, []);
      code += `    jsonData := []byte(${JSON.stringify(body)})\n`;
      code += `    req, err := http.NewRequest("${request.method}", "${url}", bytes.NewBuffer(jsonData))\n`;
    } else {
      code += `    req, err := http.NewRequest("${request.method}", "${url}", nil)\n`;
    }
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
    const data = request.body.urlencoded
      .filter(u => u.enabled)
      .map(u => `${encodeURIComponent(u.key)}=${encodeURIComponent(replaceVariables(u.value, variables, []))}`)
      .join('&');
    code += `    data := []byte("${data}")\n`;
    code += `    req, err := http.NewRequest("${request.method}", "${url}", bytes.NewBuffer(data))\n`;
  } else {
    code += `    req, err := http.NewRequest("${request.method}", "${url}", nil)\n`;
  }

  code += `    if err != nil {\n        panic(err)\n    }\n\n`;

  // Add headers
  for (const header of request.headers) {
    if (header.enabled) {
      const value = replaceVariables(header.value, variables, []);
      code += `    req.Header.Set("${header.key}", "${value}")\n`;
    }
  }

  // Add auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    const token = replaceVariables(request.auth.bearer.token, variables, []);
    code += `    req.Header.Set("Authorization", "Bearer ${token}")\n`;
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    code += `    req.SetBasicAuth("${request.auth.basic.username}", "${request.auth.basic.password}")\n`;
  } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
    const value = replaceVariables(request.auth.apiKey.value, variables, []);
    code += `    req.Header.Set("${request.auth.apiKey.key}", "${value}")\n`;
  }

  code += `\n    client := &http.Client{}\n`;
  code += `    resp, err := client.Do(req)\n`;
  code += `    if err != nil {\n        panic(err)\n    }\n`;
  code += `    defer resp.Body.Close()\n\n`;
  code += `    body, err := io.ReadAll(resp.Body)\n`;
  code += `    if err != nil {\n        panic(err)\n    }\n\n`;
  code += `    fmt.Println(string(body))\n`;
  code += `}\n`;

  return code;
};

// Generate Rust reqwest code from request
export const generateRust = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = replaceVariables(request.url, variables, []);
  let code = `use reqwest::header::{HeaderMap, HeaderValue};\nuse std::error::Error;\n\n`;

  code += `#[tokio::main]\nasync fn main() -> Result<(), Box<dyn Error>> {\n`;
  code += `    let client = reqwest::Client::new();\n\n`;

  // Add headers
  const hasHeaders = request.headers.some(h => h.enabled) || request.auth.type !== 'none';
  if (hasHeaders) {
    code += `    let mut headers = HeaderMap::new();\n`;

    for (const header of request.headers) {
      if (header.enabled) {
        const value = replaceVariables(header.value, variables, []);
        code += `    headers.insert("${header.key}", HeaderValue::from_static("${value}"));\n`;
      }
    }

    // Add auth headers
    if (request.auth.type === 'bearer' && request.auth.bearer) {
      const token = replaceVariables(request.auth.bearer.token, variables, []);
      code += `    headers.insert("Authorization", HeaderValue::from_static("Bearer ${token}"));\n`;
    } else if (request.auth.type === 'basic' && request.auth.basic) {
      const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
      code += `    headers.insert("Authorization", HeaderValue::from_static("Basic ${credentials}"));\n`;
    } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
      const value = replaceVariables(request.auth.apiKey.value, variables, []);
      code += `    headers.insert("${request.auth.apiKey.key}", HeaderValue::from_static("${value}"));\n`;
    }

    code += `\n`;
  }

  code += `    let response = client.${request.method.toLowerCase()}("${url}")\n`;
  if (hasHeaders) {
    code += `        .headers(headers)\n`;
  }

  // Add body
  if (request.body.type === 'json' && request.body.raw) {
    const body = replaceVariables(request.body.raw, variables, []);
    code += `        .body(${JSON.stringify(body)})\n`;
  } else if (request.body.type === 'raw' && request.body.raw) {
    const body = replaceVariables(request.body.raw, variables, []);
    code += `        .body("${body.replace(/"/g, '\\"')}")\n`;
  }

  code += `        .send()\n        .await?;\n\n`;
  code += `    let body = response.text().await?;\n`;
  code += `    println!("{}", body);\n\n`;
  code += `    Ok(())\n`;
  code += `}\n`;

  return code;
};

// Generate C++ libcurl code from request
export const generateCpp = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = replaceVariables(request.url, variables, []);
  let code = `#include <iostream>\n#include <string>\n#include <curl/curl.h>\n\n`;

  code += `static size_t WriteCallback(void *contents, size_t size, size_t nmemb, void *userp) {\n`;
  code += `    ((std::string*)userp)->append((char*)contents, size * nmemb);\n`;
  code += `    return size * nmemb;\n`;
  code += `}\n\n`;

  code += `int main() {\n`;
  code += `    CURL *curl;\n`;
  code += `    CURLcode res;\n`;
  code += `    std::string readBuffer;\n\n`;
  code += `    curl = curl_easy_init();\n`;
  code += `    if(curl) {\n`;
  code += `        curl_easy_setopt(curl, CURLOPT_URL, "${url}");\n`;
  code += `        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "${request.method}");\n`;
  code += `        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);\n`;
  code += `        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &readBuffer);\n\n`;

  // Add headers
  const hasHeaders = request.headers.some(h => h.enabled) || request.auth.type !== 'none';
  if (hasHeaders) {
    code += `        struct curl_slist *headers = NULL;\n`;

    for (const header of request.headers) {
      if (header.enabled) {
        const value = replaceVariables(header.value, variables, []);
        code += `        headers = curl_slist_append(headers, "${header.key}: ${value}");\n`;
      }
    }

    // Add auth headers
    if (request.auth.type === 'bearer' && request.auth.bearer) {
      const token = replaceVariables(request.auth.bearer.token, variables, []);
      code += `        headers = curl_slist_append(headers, "Authorization: Bearer ${token}");\n`;
    } else if (request.auth.type === 'basic' && request.auth.basic) {
      const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
      code += `        headers = curl_slist_append(headers, "Authorization: Basic ${credentials}");\n`;
    } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
      const value = replaceVariables(request.auth.apiKey.value, variables, []);
      code += `        headers = curl_slist_append(headers, "${request.auth.apiKey.key}: ${value}");\n`;
    }

    code += `        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);\n\n`;
  }

  // Add body
  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      const body = replaceVariables(request.body.raw, variables, []);
      code += `        const char* postData = ${JSON.stringify(body)};\n`;
      code += `        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, postData);\n\n`;
    }
  }

  code += `        res = curl_easy_perform(curl);\n`;
  code += `        if(res != CURLE_OK) {\n`;
  code += `            std::cerr << "curl_easy_perform() failed: " << curl_easy_strerror(res) << std::endl;\n`;
  code += `        } else {\n`;
  code += `            std::cout << readBuffer << std::endl;\n`;
  code += `        }\n\n`;

  if (hasHeaders) {
    code += `        curl_slist_free_all(headers);\n`;
  }

  code += `        curl_easy_cleanup(curl);\n`;
  code += `    }\n`;
  code += `    return 0;\n`;
  code += `}\n`;

  return code;
};

