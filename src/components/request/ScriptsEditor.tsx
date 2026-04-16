import { useState, useRef } from 'react';
import CodeEditor, { CodeEditorHandle } from '../CodeEditor';
import { AIScriptAssistButton } from '../AIAssistant';

// ─── Script Snippets Data ─────────────────────────────────────────────────────

interface Snippet {
  label: string;
  description: string;
  code: string;
}

const PRE_SCRIPT_SNIPPETS: Snippet[] = [
  { label: 'Set Env Variable', description: 'Set a value in the active environment', code: "fetchy.environment.set('key', 'value');" },
  { label: 'Get Env Variable', description: 'Read a value from the active environment', code: "const value = fetchy.environment.get('key');" },
  { label: 'Get All Variables', description: 'Get an array of all environment variables', code: "const vars = fetchy.environment.all();\nconsole.log(vars);" },
  { label: 'Log Output', description: 'Print a message to the Console tab', code: "console.log('message');" },
  { label: 'Random UUID', description: 'Generate a UUID and store it as an env variable', code: "const uuid = crypto.randomUUID();\nfetchy.environment.set('uuid', uuid);\nconsole.log('UUID:', uuid);" },
  { label: 'Unix Timestamp', description: 'Store the current Unix timestamp as an env variable', code: "const ts = String(Date.now());\nfetchy.environment.set('timestamp', ts);\nconsole.log('Timestamp:', ts);" },
  { label: 'Random Number', description: 'Generate a random integer in a range', code: "const rand = String(Math.floor(Math.random() * 1000));\nfetchy.environment.set('randomNum', rand);" },
  { label: 'Dynamic Auth Token', description: 'Use an existing env var as bearer in a header', code: "// Make sure 'token' is set in your environment\n// fetchy.environment.set('token', '<your-token-here>');" },
];

const POST_SCRIPT_SNIPPETS: Snippet[] = [
  { label: 'Log Response', description: 'Print the full response body to the Console tab', code: "console.log(fetchy.response.data);" },
  { label: 'Get Response Status', description: 'Read the HTTP status code', code: "const status = fetchy.response.status;\nconsole.log('Status:', status);" },
  { label: 'Get Response Header', description: 'Read a specific response header', code: "const ct = fetchy.response.headers['content-type'];\nconsole.log('Content-Type:', ct);" },
  { label: 'Extract & Store Field', description: 'Pull a field from the JSON response and save it as an env variable', code: "const value = fetchy.response.data.field;\nfetchy.environment.set('key', value);" },
  { label: 'Store Token', description: 'Save an access token from the response body', code: "const token = fetchy.response.data.access_token\n  || fetchy.response.data.token;\nif (token) {\n  fetchy.environment.set('token', token);\n  console.log('Token saved.');\n}" },
  { label: 'Check Status 200', description: 'Log a message only when the request succeeds', code: "if (fetchy.response.status === 200) {\n  console.log('Request succeeded!');\n} else {\n  console.log('Unexpected status:', fetchy.response.status);\n}" },
  { label: 'Set Env Variable', description: 'Set a value in the active environment', code: "fetchy.environment.set('key', 'value');" },
  { label: 'Get Env Variable', description: 'Read a value from the active environment', code: "const value = fetchy.environment.get('key');" },
  { label: 'Log All Env Vars', description: 'Print every environment variable to the Console', code: "const vars = fetchy.environment.all();\nconsole.log(vars);" },
];

// ─── ScriptsEditor Component ──────────────────────────────────────────────────

interface ScriptsEditorProps {
  type: 'pre' | 'post';
  value: string;
  onChange: (value: string) => void;
}

export default function ScriptsEditor({ type, value, onChange }: ScriptsEditorProps) {
  const editorRef = useRef<CodeEditorHandle>(null);

  return (
    <div className="h-full flex">
      <div className="flex-1 overflow-hidden">
        <CodeEditor
          ref={editorRef}
          value={value}
          onChange={onChange}
          language="javascript"
        />
      </div>
      <ScriptSnippetsPanel
        type={type}
        scriptValue={value}
        onInsert={(code) => editorRef.current?.insertAtCursor(code)}
        onApply={onChange}
      />
    </div>
  );
}

// ─── Script Snippets Panel ────────────────────────────────────────────────────

function ScriptSnippetsPanel({ type, scriptValue, onInsert, onApply }: {
  type: 'pre' | 'post';
  scriptValue: string;
  onInsert: (code: string) => void;
  onApply: (code: string) => void;
}) {
  const snippets = type === 'pre' ? PRE_SCRIPT_SNIPPETS : POST_SCRIPT_SNIPPETS;
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={`h-full border-l border-fetchy-border bg-fetchy-card flex flex-col transition-all duration-200 ${
        expanded ? 'w-56' : 'w-8'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-fetchy-border shrink-0">
        {expanded && (
          <span className="text-xs font-semibold text-fetchy-text-muted uppercase tracking-wide truncate">
            Snippets
          </span>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto p-0.5 rounded hover:bg-fetchy-border text-fetchy-text-muted hover:text-fetchy-text transition-colors"
          title={expanded ? 'Collapse snippets' : 'Expand snippets'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className={`transition-transform ${expanded ? '' : 'rotate-180'}`}
          >
            <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {expanded && (
        <>
          {/* AI Assist — above the snippet list */}
          <div className="px-2 pt-2 pb-1 shrink-0">
            <AIScriptAssistButton
              scriptType={type}
              scriptValue={scriptValue}
              onApply={onApply}
            />
          </div>

          {/* Divider */}
          <div className="mx-2 border-t border-fetchy-border shrink-0" />

          {/* Snippet list */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {snippets.map((snippet) => (
              <button
                key={snippet.label}
                onClick={() => onInsert(snippet.code)}
                className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-fetchy-border transition-colors group"
                title={snippet.description}
              >
                <span className="block font-medium text-fetchy-accent group-hover:text-fetchy-accent truncate">
                  {snippet.label}
                </span>
                <span className="block text-fetchy-text-muted truncate mt-0.5 text-[10px]">
                  {snippet.description}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
