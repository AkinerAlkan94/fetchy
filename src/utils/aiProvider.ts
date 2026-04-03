/**
 * AI Provider utility – builds prompts for each AI feature and routes
 * requests through the Electron IPC bridge (or falls back to fetch in
 * browser mode for development).
 */

import type {
  AISettings,
  AIMessage,
  AIResponseResult,
  AIProvider,
  ApiRequest,
  ApiResponse,
} from '../types';

// ─── Default AI settings ────────────────────────────────────────────────────

export const defaultAISettings: AISettings = {
  enabled: true,
  provider: 'openai',
  apiKey: '',
  model: '',
  baseUrl: '',
  temperature: 0.7,
  maxTokens: 2048,
  persistToFile: false,
};

// ─── Provider metadata ──────────────────────────────────────────────────────

export interface ProviderMeta {
  label: string;
  description: string;
  models: string[];
  defaultModel: string;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  baseUrlPlaceholder?: string;
}

export const PROVIDER_META: Record<AIProvider, ProviderMeta> = {
  openai: {
    label: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini and other OpenAI models',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3-mini'],
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
  gemini: {
    label: 'Google Gemini',
    description: 'Gemini 2.0 Flash, Pro and other Google AI models',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    defaultModel: 'gemini-2.0-flash',
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
  claude: {
    label: 'Anthropic Claude',
    description: 'Claude Sonnet, Haiku and other Anthropic models',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    defaultModel: 'claude-sonnet-4-20250514',
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
  ollama: {
    label: 'Ollama (Local)',
    description: 'Run local models with Ollama – no API key needed',
    models: ['llama3', 'llama3.1', 'mistral', 'codellama', 'gemma2', 'phi3', 'qwen2'],
    defaultModel: 'llama3',
    requiresApiKey: false,
    requiresBaseUrl: true,
    baseUrlPlaceholder: 'http://localhost:11434',
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    description: 'Any OpenAI-compatible API endpoint',
    models: [],
    defaultModel: '',
    requiresApiKey: false,
    requiresBaseUrl: true,
    baseUrlPlaceholder: 'https://your-api.example.com',
  },
};

// ─── Prompt builders ────────────────────────────────────────────────────────

function requestSummary(req: ApiRequest): string {
  const parts = [`${req.method} ${req.url}`];
  const enabledHeaders = req.headers.filter((h) => h.enabled && h.key);
  if (enabledHeaders.length) {
    parts.push('Headers: ' + enabledHeaders.map((h) => `${h.key}: ${h.value}`).join(', '));
  }
  if (req.body.type !== 'none' && req.body.raw) {
    const bodyPreview = req.body.raw.length > 1000 ? req.body.raw.slice(0, 1000) + '…' : req.body.raw;
    parts.push(`Body (${req.body.type}): ${bodyPreview}`);
  }
  return parts.join('\n');
}

function responseSummary(res: ApiResponse): string {
  const parts = [`Status: ${res.status} ${res.statusText}`, `Time: ${res.time}ms`, `Size: ${res.size} bytes`];
  if (res.body) {
    const bodyPreview = res.body.length > 2000 ? res.body.slice(0, 2000) + '…' : res.body;
    parts.push(`Body:\n${bodyPreview}`);
  }
  return parts.join('\n');
}

export function buildGenerateRequestPrompt(description: string): AIMessage[] {
  return [
    {
      role: 'system',
      content: `You are an expert API developer assistant integrated into a REST client application called Fetchy.
When the user describes an API request in natural language, generate a valid JSON object with this exact structure:
{
  "method": "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
  "url": "full URL with protocol",
  "headers": [{"key": "Content-Type", "value": "application/json", "enabled": true}],
  "params": [{"key": "param", "value": "value", "enabled": true}],
  "body": {"type": "none|json|form-data|x-www-form-urlencoded|raw", "raw": "body content if applicable"},
  "name": "A descriptive name for the request"
}
Return ONLY the JSON object, no markdown fences, no explanation.`,
    },
    { role: 'user', content: description },
  ];
}

export function buildGenerateScriptPrompt(
  req: ApiRequest,
  res: ApiResponse | undefined,
  scriptType: 'pre-request' | 'test'
): AIMessage[] {
  const context = [`Request:\n${requestSummary(req)}`];
  if (res) context.push(`Response:\n${responseSummary(res)}`);

  const scriptPurpose =
    scriptType === 'pre-request'
      ? 'a pre-request script that runs before the request is sent. It can set environment variables, log information, generate dynamic values, etc.'
      : 'a test/post-request script that runs after receiving the response. It should validate the response status, check response body content, extract and store values, etc.';

  const preRequestAPI = `Pre-request script API:
- fetchy.environment.get(key)        → returns the value of an environment variable
- fetchy.environment.set(key, value) → sets an environment variable
- fetchy.environment.all()           → returns an array of all environment variables
- console.log(...)                   → print output to the Console tab`;

  const postRequestAPI = `Post-request (test) script API:
- fetchy.response.data               → parsed JSON response body (object)
- fetchy.response.headers            → response headers object
- fetchy.response.status             → HTTP status code (number, e.g. 200)
- fetchy.response.statusText         → HTTP status text (string, e.g. "OK")
- fetchy.environment.get(key)        → returns the value of an environment variable
- fetchy.environment.set(key, value) → sets an environment variable
- fetchy.environment.all()           → returns an array of all environment variables
- console.log(...)                   → print output to the Console tab`;

  const apiReference = scriptType === 'pre-request' ? preRequestAPI : postRequestAPI;

  return [
    {
      role: 'system',
      content: `You are an expert API testing assistant integrated into Fetchy, a REST client application.
Generate ${scriptPurpose}

IMPORTANT: Fetchy uses its own scripting API. Do NOT use pm.*, postman.*, pw.*, bru.*, or any other API client globals.
Only use the fetchy.* API described below.

${apiReference}

Use standard JavaScript conditionals and console.log for assertions/validation (there is no pm.test or pm.expect).

Return ONLY the JavaScript code, no markdown fences, no explanation.`,
    },
    {
      role: 'user',
      content: `Generate a ${scriptType} script for this request:\n\n${context.join('\n\n')}`,
    },
  ];
}

export function buildExplainResponsePrompt(req: ApiRequest, res: ApiResponse): AIMessage[] {
  return [
    {
      role: 'system',
      content: `You are an expert API developer assistant integrated into Fetchy, a REST client application.
Explain the API response in a clear, concise and developer-friendly way. Include:
1. What the status code means
2. A summary of the response headers (only notable ones)
3. An explanation of the response body structure and content
4. Any potential issues or things to note
Keep it brief but informative. Use markdown formatting.`,
    },
    {
      role: 'user',
      content: `Explain this API response:\n\nRequest: ${req.method} ${req.url}\n\n${responseSummary(res)}`,
    },
  ];
}

export function buildGenerateDocsPrompt(req: ApiRequest, res?: ApiResponse): AIMessage[] {
  const context = [requestSummary(req)];
  if (res) context.push(responseSummary(res));
  return [
    {
      role: 'system',
      content: `You are an expert technical writer integrated into Fetchy, a REST client application.
Generate clear API documentation in markdown for the given request/response. Include:
1. Endpoint description
2. HTTP method and URL
3. Request headers (table)
4. Request parameters (table)
5. Request body schema (if applicable)
6. Response format with example
7. Status codes and their meanings
Be concise and professional.`,
    },
    {
      role: 'user',
      content: `Generate API documentation for:\n\n${context.join('\n\n')}`,
    },
  ];
}

export function buildSuggestNamePrompt(req: ApiRequest): AIMessage[] {
  return [
    {
      role: 'system',
      content: `You are an API naming assistant. Given an API request, suggest a short, descriptive name (3-6 words max).
Return ONLY the name, nothing else. No quotes, no explanation.`,
    },
    {
      role: 'user',
      content: `Suggest a name for: ${req.method} ${req.url}${req.body.type !== 'none' ? ` (body: ${req.body.type})` : ''}`,
    },
  ];
}

export function buildGenerateBugReportPrompt(req: ApiRequest, res: ApiResponse, userNote: string): AIMessage[] {
  // Format: YYYY-MM-DD HH:MM:SS (user's local timezone)
  const now = new Date();
  const reportDate = now.toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const fullHeaders = req.headers
    .filter((h) => h.enabled && h.key)
    .map((h) => `${h.key}: ${h.value}`)
    .join('\n');

  const fullParams = req.params
    .filter((p) => p.enabled && p.key)
    .map((p) => `${p.key}=${p.value}`)
    .join('\n');

  let requestBody = '(none)';
  if (req.body.type !== 'none') {
    if (req.body.raw) {
      requestBody = `[${req.body.type}]\n${req.body.raw}`;
    } else if (req.body.type === 'form-data' && req.body.formData) {
      requestBody = `[form-data]\n${req.body.formData.filter(f => f.enabled).map(f => `${f.key}: ${f.value}`).join('\n')}`;
    } else if (req.body.type === 'x-www-form-urlencoded' && req.body.urlencoded) {
      requestBody = `[x-www-form-urlencoded]\n${req.body.urlencoded.filter(f => f.enabled).map(f => `${f.key}=${f.value}`).join('&')}`;
    }
  }

  const responseHeaders = Object.entries(res.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  let responseBody = res.body || '(empty)';
  if (responseBody.length > 5000) {
    responseBody = responseBody.slice(0, 5000) + '\n... (truncated)';
  }

  return [
    {
      role: 'system',
      content: `You are an expert QA engineer and bug report writer integrated into Fetchy, a REST client application.
Generate a detailed, well-structured bug report in markdown using EXACTLY this template:

---

# 🐛 Bug Report

## Title
<A concise, descriptive one-line title>

## Severity
<Critical / High / Medium / Low – infer from the status code and issue>

## Environment
- **Tool:** Fetchy REST Client
- **Date:** ${reportDate}

## Description
<2-3 sentence summary of the issue based on the user's note and the actual response>

## Steps to Reproduce
1. Open Fetchy REST Client
2. Create a new **<METHOD>** request to \`<URL>\`
3. Set the following headers: <list headers or "(none)">
4. Set the following query parameters: <list params or "(none)">
5. Set the request body: <describe body or "(none)">
6. Send the request

## Expected Result
<What the user expected based on their note>

## Actual Result
- **Status Code:** <status> <statusText>
- **Response Time:** <time>ms
- **Response Size:** <size> bytes

### Response Headers
\`\`\`
<response headers>
\`\`\`

### Response Body
\`\`\`json
<response body>
\`\`\`

## Request Details (for reproduction)

### Request Headers
\`\`\`
<request headers>
\`\`\`

### Request Body
\`\`\`
<request body>
\`\`\`

## Analysis
<Brief technical analysis of what might be going wrong, based on the status code, headers, and response body>

## Suggested Next Steps
- <action 1>
- <action 2>
- <action 3>

---

Fill in ALL sections using the provided request/response data. Use markdown formatting. Do NOT skip any section.`,
    },
    {
      role: 'user',
      content: `Generate a bug report for this API issue.

User's note: ${userNote}

--- REQUEST ---
Method: ${req.method}
URL: ${req.url}
Headers:
${fullHeaders || '(none)'}
Query Parameters:
${fullParams || '(none)'}
Body:
${requestBody}
Authentication: ${req.auth.type !== 'none' ? req.auth.type : '(none)'}

--- RESPONSE ---
Status: ${res.status} ${res.statusText}
Time: ${res.time}ms
Size: ${res.size} bytes
Headers:
${responseHeaders}
Body:
${responseBody}`,
    },
  ];
}

// ─── Request execution ──────────────────────────────────────────────────────

export async function sendAIRequest(
  settings: AISettings,
  messages: AIMessage[]
): Promise<AIResponseResult> {
  if (!settings.enabled) {
    return { success: false, content: '', error: 'AI features are not enabled. Configure them in Settings → AI.' };
  }

  const meta = PROVIDER_META[settings.provider];
  if (meta.requiresApiKey && !settings.apiKey) {
    return { success: false, content: '', error: `API key is required for ${meta.label}. Configure it in Settings → AI.` };
  }
  if (meta.requiresBaseUrl && !settings.baseUrl && settings.provider !== 'ollama') {
    return { success: false, content: '', error: `Base URL is required for ${meta.label}. Configure it in Settings → AI.` };
  }

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  if (isElectron && window.electronAPI) {
    return window.electronAPI.aiRequest({
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model || meta.defaultModel,
      baseUrl: settings.baseUrl,
      messages,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    });
  }

  // Browser fallback – direct fetch (will be blocked by CORS for most providers)
  return { success: false, content: '', error: 'AI features require the Electron desktop app.' };
}
