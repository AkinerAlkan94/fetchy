/**
 * IPC handler for AI provider requests.
 * Handles: ai-request
 *
 * Supports: Google Gemini, Ollama, and Siemens AI (siemens.io).
 *
 * @module electron/ipc/aiHandler
 */
'use strict';

const https = require('https');
const http = require('http');
const { requireOneOf, requireArray, optionalString, requireObject } = require('./validate');

/**
 * Build the HTTP request options for each AI provider.
 * Returns { url, headers, body } ready to send.
 */
function buildAIRequest(provider, apiKey, model, baseUrl, messages, temperature, maxTokens) {
  switch (provider) {
    case 'gemini': {
      // Google Gemini uses contents/parts structure
      const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
      const systemInstruction = messages.find((m) => m.role === 'system');
      const geminiBody = {
        contents,
        generationConfig: {
          temperature: temperature ?? 0.7,
          maxOutputTokens: maxTokens ?? 2048,
        },
      };
      if (systemInstruction) {
        geminiBody.systemInstruction = { parts: [{ text: systemInstruction.content }] };
      }
      const geminiModel = model || 'gemini-2.5-flash';
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(geminiBody),
      };
    }
    case 'ollama': {
      // Ollama exposes an OpenAI-compatible endpoint locally
      const ollamaBase = baseUrl || 'http://localhost:11434';
      return {
        url: `${ollamaBase}/v1/chat/completions`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'llama3.1',
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 2048,
        }),
      };
    }
    case 'siemens': {
      // Siemens LLM API – OpenAI-compatible endpoint at api.siemens.com
      // Auth uses a SIAK prefixed Bearer token
      return {
        url: 'https://api.siemens.com/llm/v1/chat/completions',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'mistral-7b-instruct',
          messages,
        }),
      };
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * Parse the AI provider response into a unified format.
 */
function parseAIResponse(provider, responseBody) {
  try {
    const data = JSON.parse(responseBody);

    if (provider === 'gemini') {
      // Gemini response format
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return {
        success: true,
        content,
        usage: data.usageMetadata
          ? {
              promptTokens: data.usageMetadata.promptTokenCount || 0,
              completionTokens: data.usageMetadata.candidatesTokenCount || 0,
              totalTokens: data.usageMetadata.totalTokenCount || 0,
            }
          : undefined,
      };
    }
    // OpenAI-compatible format (ollama, siemens)
    const content = data.choices?.[0]?.message?.content || '';
    return {
      success: true,
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : undefined,
    };
  } catch {
    return { success: false, content: '', error: 'Failed to parse AI response: ' + responseBody.slice(0, 500) };
  }
}

/**
 * Register the ai-request IPC handler.
 *
 * @param {Electron.IpcMain} ipcMain
 * @param {object} _deps - Reserved for future use
 */
function register(ipcMain, _deps) {
  ipcMain.handle('ai-request', async (event, data) => {
    return new Promise((resolve) => {
      try {
        // Validate inputs
        requireObject(data, 'ai request data');
        const provider = requireOneOf(data.provider, 'provider', ['gemini', 'ollama', 'siemens']);
        const apiKey = optionalString(data.apiKey, 'apiKey', 10_000);
        const model = optionalString(data.model, 'model', 500);
        const baseUrl = optionalString(data.baseUrl, 'baseUrl', 2000);
        const messages = requireArray(data.messages, 'messages', 1000);
        const temperature = data.temperature != null ? Math.max(0, Math.min(2, Number(data.temperature) || 0.7)) : undefined;
        const maxTokens = data.maxTokens != null ? Math.max(1, Math.min(1_000_000, Math.round(Number(data.maxTokens) || 2048))) : undefined;

        const { url, headers, body } = buildAIRequest(provider, apiKey, model, baseUrl, messages, temperature, maxTokens);

        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers,
          // AI requests always verify TLS — they carry API keys
          rejectUnauthorized: true,
        };

        const req = httpModule.request(options, (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const responseBody = Buffer.concat(chunks).toString('utf-8');
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parseAIResponse(provider, responseBody));
            } else {
              let errorMsg = `AI request failed (${res.statusCode})`;
              try {
                const errData = JSON.parse(responseBody);
                errorMsg = errData.error?.message || errData.error?.type || errData.message || errorMsg;
              } catch {}
              resolve({ success: false, content: '', error: errorMsg });
            }
          });
        });

        req.on('error', (error) => {
          let errorMsg = error.message;
          if (error.code === 'ENOTFOUND') errorMsg = 'DNS lookup failed – check your internet connection or API URL';
          else if (error.code === 'ECONNREFUSED') errorMsg = 'Connection refused – is the AI service running?';
          else if (error.code === 'ETIMEDOUT') errorMsg = 'Connection timed out';
          resolve({ success: false, content: '', error: errorMsg });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ success: false, content: '', error: 'AI request timed out after 60 seconds' });
        });

        req.setTimeout(60000); // 60s timeout for AI requests
        if (body) req.write(body);
        req.end();
      } catch (error) {
        resolve({ success: false, content: '', error: error.message });
      }
    });
  });
}

module.exports = { register, buildAIRequest, parseAIResponse };
