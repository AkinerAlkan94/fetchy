# Roadmap Task Status

> This document tracks the implementation status and details of each roadmap item fix.

---

## #6 · Script execution timeout — `Already Implemented`

**Status:** ✅ Complete (was already implemented as part of #1 sandbox work)

**What was found:**
- `src/utils/httpClient.ts` already contains a `SCRIPT_TIMEOUT_MS = 10_000` constant (line ~251)
- The `runScriptInWorker()` function creates a Web Worker for each script execution
- A `setTimeout` kills the worker after 10 seconds and resolves with a timeout error message
- The comment on line 249 explicitly references "#6": *"A hard timeout (default 10 s) protects against infinite loops (#6)."*
- `while(true){}` in a pre/post-script will be terminated after 10 seconds with a clear error

**No code changes needed** — only the roadmap checkbox was updated.

---

## #7 · Debounce persistence writes — `Implemented`

**Status:** ✅ Complete

**Changes made:**
1. **`src/store/persistence.ts`** — Added `createDebouncedStorage()` wrapper function that wraps any `StateStorage` with a 1.5-second debounce on `setItem`. `getItem` and `removeItem` pass through immediately. The debounce uses a simple timer pattern: each new `setItem` call resets the timer, so only the last value in a rapid-fire sequence is written.
2. **`src/store/appStore.ts`** — Updated the persist config to wrap the custom storage with `createDebouncedStorage(createCustomStorage())` instead of calling `createCustomStorage()` directly. Also updated the import to include `createDebouncedStorage`.

**How it works:**
- Every state change still triggers `setItem`, but the debounce wrapper delays the actual write by 1.5 seconds
- If another write arrives within the window, the timer resets and only the latest value is written
- This eliminates dozens of redundant disk writes per second during rapid editing (typing URLs, editing headers, etc.)
- Read operations (`getItem`) are not debounced — they always pass through immediately

---

## #8 · Cap in-memory response size — `Implemented`

**Status:** ✅ Complete

**Changes made:**
1. **`src/types/index.ts`** — Added `bodyTruncated?: boolean` and `fullBodySize?: number` optional fields to `ApiResponse` interface.
2. **`electron/main.js`** — Added `MAX_RESPONSE_BYTES = 10 MB` constant. The HTTP handler now tracks total bytes received and stops accumulating chunks once the limit is reached. The response includes `bodyTruncated` and `fullBodySize` fields when truncated.
3. **`src/utils/httpClient.ts`** — Added `MAX_RESPONSE_BODY_BYTES = 5 MB` constant and `capResponseBody()` helper function. Applied after both Electron and browser response paths. Truncates the body string and appends a truncation notice.
4. **`src/components/ResponsePanel.tsx`** — Added `Download` icon import. Added `handleSaveFullResponse()` function that uses Electron's `saveFile` API (or browser blob download fallback). Added a yellow warning banner in the response body tab when `bodyTruncated` is true, showing original size and a "Save Full Response" button.

**How it works:**
- Main process caps chunk accumulation at 10 MB (prevents IPC issues)
- Renderer-side `capResponseBody()` further truncates to 5 MB for in-memory display
- Truncated responses show a clear yellow banner with the original file size
- Users can click "Save Full Response" to download the full (up to 10 MB) response body

---

## #9 · Add Content-Security-Policy — `Implemented`

**Status:** ✅ Complete

**Changes made:**
1. **`electron/main.js`** — Added `session.defaultSession.webRequest.onHeadersReceived` in the `app.whenReady()` callback, before `createWindow()` is called. Applies a strict CSP header to all responses loaded in the renderer.

**CSP directives applied:**
- `default-src 'self'` — Only allow resources from the app origin
- `script-src 'self' blob:` — Scripts only from self + blob URLs (needed for Web Worker sandboxed script execution)
- `style-src 'self' 'unsafe-inline'` — Allow inline styles (Tailwind/Vite injects style tags)
- `img-src 'self' data: https:` — Images from self, data URIs, or HTTPS
- `font-src 'self' data:` — Fonts from self or data URIs
- `connect-src *` — Allow connections to any origin (required for arbitrary API endpoint testing)
- `worker-src 'self' blob:` — Workers from self or blob URLs

**Why `connect-src *`:** Fetchy is an API client that must be able to send HTTP requests to any URL the user specifies. Restricting `connect-src` would break the core functionality.

---

## #10 · Encrypt secrets at rest — `Implemented`

**Status:** ✅ Complete

**Changes made:**
1. **`electron/main.js`** — Imported `safeStorage` from Electron. Added two new helper functions:
   - `readEncryptedSecrets(secretsDir, baseName)` — Reads `.enc` file and decrypts with `safeStorage.decryptString()`. If only plaintext `.json` exists, reads it and auto-migrates to encrypted `.enc`.
   - `writeEncryptedSecrets(secretsDir, baseName, content)` — Encrypts with `safeStorage.encryptString()` and writes as binary `.enc` file atomically. Falls back to plaintext if safeStorage is unavailable.
2. Updated all four secrets IPC handlers (`read-secrets`, `write-secrets`, `read-ai-secrets`, `write-ai-secrets`) to use the new encrypted helpers.
3. Updated `delete-ai-secrets` to remove both `.enc` and `.json` variants.
4. Updated workspace export to use `readEncryptedSecrets()` for reading secrets.
5. Updated workspace import to use `writeEncryptedSecrets()` for writing secrets.
6. Updated `.gitignore` template to include `*.enc` files alongside `.json` files.

**How it works:**
- Electron's `safeStorage` uses the OS keychain (Windows DPAPI / macOS Keychain / Linux Secret Service) to encrypt/decrypt strings
- Secrets are stored as binary `.enc` files, unreadable without the OS keychain
- On first read, existing plaintext `.json` files are automatically migrated to encrypted `.enc` and the plaintext file is deleted
- If safeStorage is unavailable (rare edge case), falls back to plaintext for compatibility
- The migration is transparent — the renderer receives the same JSON strings it always did

---

## #11 · Move Gemini API key to header — `Implemented`

**Status:** ✅ Complete

**Changes made:**
1. **`electron/main.js`** — In the `buildAIRequestOptions` function's `gemini` case:
   - Removed `?key=${apiKey}` query parameter from the URL
   - Added `'x-goog-api-key': apiKey` to the request headers

**Before:**
```js
url: `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
headers: { 'Content-Type': 'application/json' },
```

**After:**
```js
url: `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
```

**Why:** API keys in query strings can leak through server logs, browser history, referrer headers, and proxy logs. Moving to a request header (`x-goog-api-key`) follows Google's recommended practice and prevents accidental exposure.

---

## #12 · Regenerate child IDs on import — `Implemented`

**Status:** ✅ Complete

**Changes made:**
1. **`src/store/appStore.ts`** — Rewrote the `importCollection` action to recursively regenerate UUIDs:
   - Collection gets a new `id` via `uuidv4()`
   - All top-level requests get new IDs
   - All variables get new IDs
   - All folders get new IDs via recursive `regenerateIds()` helper
   - All requests within folders (at any depth) get new IDs
   - All sub-folders (at any depth) get new IDs

**Before:** Only the collection's top-level `id` was regenerated. Importing the same collection twice caused ID collisions in the store for inner requests and folders.

**After:** Every entity (collection, folder, request, variable) at every nesting level gets a fresh UUID. Importing the same collection multiple times is now safe.

---

## #13 · Decompose `electron/main.js` — `Implemented`

**Status:** ✅ Complete

**Problem:** `electron/main.js` was a 1,776-line monolith mixing 7+ unrelated concerns (file I/O, secrets encryption, HTTP proxying, AI requests, workspace management, window lifecycle). This made the file difficult to navigate, test, and maintain.

**Solution:** Extracted every IPC handler group into a dedicated module under `electron/ipc/`, leaving `main.js` as a thin orchestrator (~373 lines) responsible only for:
- App lifecycle (`app.whenReady`, `window-all-closed`, `activate`)
- Window creation and state persistence
- CSP configuration
- Shared helper functions (`safeWriteFileSync`, storage watcher, preferences/workspaces config)
- Module registration via a shared `ipcDeps` dependency object

**Files created:**
| File | Responsibility | IPC channels |
|------|---------------|--------------|
| `electron/ipc/fileHandlers.js` | File open/save/read/write/list/delete | `open-file`, `save-file`, `get-data-path`, `read-data`, `write-data`, `list-data-dir`, `delete-data-file` |
| `electron/ipc/secretsHandler.js` | Encrypted secrets read/write/delete | `read-secrets`, `write-secrets`, `read-ai-secrets`, `write-ai-secrets`, `delete-ai-secrets` |
| `electron/ipc/httpHandler.js` | Proxied HTTP requests with response cap | `http-request` |
| `electron/ipc/aiHandler.js` | AI provider requests (OpenAI, Claude, Gemini, Ollama, custom) | `ai-request` |
| `electron/ipc/workspaceHandler.js` | Preferences + workspace management + import/export | `get-preferences`, `save-preferences`, `select-home-directory`, `get-home-directory`, `migrate-data`, `get-workspaces`, `save-workspaces`, `select-directory`, `export-workspace-to-json`, `import-workspace-from-json` |
| `electron/ipc/index.js` | Barrel export for all modules | — |

**Architecture pattern:** Each module exports a `register(ipcMain, deps)` function. Shared state (e.g., `mainWindow`, `customHomeDirectory`) is accessed through getter/setter functions in the `deps` object, avoiding tight coupling to module-scoped variables. This makes modules independently testable.

**Before:** 1,776 lines in a single file, impossible to test individual handlers in isolation.

**After:** `main.js` reduced to ~373 lines. Each concern is in its own file with clear module boundaries and a consistent registration pattern.

---

## #14 · Replace `window.location.reload()` — `Implemented`

**Status:** ✅ Complete

**Problem:** Workspace switching used `window.location.reload()` in three places in `workspacesStore.ts` and one in `App.tsx`. This discarded unsaved in-memory state, caused a jarring full page reload, and made the flow untestable.

**Solution:** Added a `rehydrateWorkspace()` function exported from `appStore.ts` that:
1. Calls `invalidateWriteCache()` to prevent stale debounced writes from overwriting the new workspace's data.
2. Resets transient state (tabs, activeTabId, activeRequest) to clean defaults.
3. Calls `useAppStore.persist.rehydrate()` to re-read persisted state from the new workspace's storage backend.

**Files modified:**
- `src/store/appStore.ts` — Added `rehydrateWorkspace()` export and `invalidateWriteCache` import.
- `src/store/workspacesStore.ts` — Replaced 3 `window.location.reload()` calls with `rehydrateWorkspace()` in `removeWorkspace`, `switchWorkspace`, and `updateWorkspace`.
- `src/App.tsx` — Replaced `window.location.reload()` in `CreateWorkspaceScreen` callback with `rehydrateWorkspace()`.

**Before:** Full page reload on workspace switch — lost in-memory state, re-parsed all JS, jarring blank flash.

**After:** Smooth in-memory state reset + rehydration from new workspace's storage. No page reload, no flash, no lost transient state beyond what's expected for a workspace switch.

---

## #15 · Wire AbortController to requests — `Fixed`

**Status:** ✅ Complete

**Problem:** The "Stop" button in the collection runner and the Send button during manual execution could not actually cancel in-flight HTTP requests. The Electron IPC `http-request` handler had no mechanism to abort an active `http.ClientRequest`, so requests would silently continue in the background even after the user tried to cancel.

**Root Cause:** The IPC is request/response — once `ipcRenderer.invoke('http-request', data)` is called, there is no built-in way to send a secondary "abort" signal. The underlying `http.request` object was not tracked or accessible for cancellation.

**Solution — 4-layer abort architecture:**

| Layer | File | Change |
|-------|------|--------|
| **IPC abort channel** | `electron/ipc/httpHandler.js` | Added `activeRequests` Map tracking in-flight `http.ClientRequest` objects by `requestId`. New `abort-http-request` IPC handler calls `req.destroy()`. Error handler detects intentional abort (`req.destroyed && 'socket hang up'`) and returns `statusText: 'Aborted'` instead of an error. |
| **Preload bridge** | `electron/preload.js` | Exposed `abortHttpRequest(requestId)` via `ipcRenderer.invoke('abort-http-request', requestId)`. |
| **Client utility** | `src/utils/httpClient.ts` | `ExecuteRequestOptions` now accepts `signal?: AbortSignal`. Electron path generates a `requestId` via `crypto.randomUUID()`, registers an abort listener on the signal that calls `window.electronAPI.abortHttpRequest(requestId)`, and cleans up in `finally`. Browser path passes `signal` directly to `fetch()`. Early-return if `signal.aborted` is already true. |
| **Type definitions** | `src/types/index.ts` | Added `requestId?: string` to `httpRequest` data, and `abortHttpRequest(requestId: string): Promise<boolean>` to `ElectronAPI`. |

**UI Integration:**

| Component | Change |
|-----------|--------|
| `src/components/RequestPanel.tsx` | Added `abortControllerRef` ref. `handleSend` creates a fresh `AbortController` and passes `signal` to `executeRequest()`. New `handleCancel` callback aborts the controller. Send button becomes a red "Cancel" button (with `XCircle` icon) while loading. Escape key also cancels. Aborted requests suppress error UI. |
| `src/components/RunCollectionModal.tsx` | Both sequential and parallel `executeRequest()` calls now pass `signal: abortControllerRef.current?.signal`. The existing Stop button already calls `abortControllerRef.current?.abort()`, which now actually terminates in-flight HTTP requests. |

**Before:** Clicking Stop/Cancel had no effect on in-flight requests — they continued to completion in the background, wasting resources and potentially causing stale response data.

**After:** Full cancellation chain from UI → renderer → main process → `http.ClientRequest.destroy()`. Requests are immediately terminated, resources freed, and the UI correctly reflects the abort.

---

## #16 · Fix auth inheritance depth — `Fixed`

**Status:** ✅ Complete

**Problem:** Auth inheritance only resolved one level: a folder checked its own auth, then fell back directly to the collection. Deeply nested folders (e.g., `Collection > Folder A > Folder B > Folder C`) couldn't inherit auth from intermediate parent folders.

**Root Cause:** Both `RequestPanel.tsx` and `RunCollectionModal.tsx` had their own inline `getInheritedAuth` implementations that searched for the target folder in the tree, checked its auth, and immediately fell back to collection-level auth — skipping all parent folders.

**Solution:**

Created `src/utils/authInheritance.ts` with a shared `resolveInheritedAuth(collection, folderId)` utility:

1. **`buildAncestorPath(folders, targetId)`** — Recursively builds the full path from collection root to the target folder, returning `[rootFolder, …, parentFolder, targetFolder]`.
2. **`resolveInheritedAuth(collection, folderId)`** — Walks the ancestor path in reverse (target → parent → … → root folder → collection), returning the first auth whose type is neither `'none'` nor `'inherit'`.

| File | Change |
|------|--------|
| `src/utils/authInheritance.ts` | NEW — shared utility with `buildAncestorPath` and `resolveInheritedAuth` |
| `src/components/RequestPanel.tsx` | Replaced 20-line inline `getInheritedAuth` with 3-line call to `resolveInheritedAuth` |
| `src/components/RunCollectionModal.tsx` | Replaced 14-line inline `getInheritedAuth` with alias to `resolveInheritedAuth`; removed unused `RequestAuth` import |

**Before:** `Collection (Bearer token) > Folder A (inherit) > Folder B (inherit) > Request` → Request gets no auth (both folders skipped, collection fallback missed in RunCollectionModal, or only direct folder checked in RequestPanel).

**After:** The full chain walks `Folder B → Folder A → Collection`, finds the Bearer token at collection level, and applies it correctly. Any intermediate folder with its own non-inherit auth will be picked up first.

---

## #17 · Add concurrency limit to collection runner — `Fixed`

**Status:** ✅ Complete

**Problem:** The parallel mode in `RunCollectionModal` fired all requests simultaneously using `Promise.all(allRequests.map(...))`. For large collections (50+ requests), this overwhelmed the HTTP handler, the target server, and potentially the OS socket pool.

**Solution:** Implemented an inline concurrency pool (`runWithLimit`) directly in the parallel execution path of `RunCollectionModal.tsx`:

- `MAX_CONCURRENCY = 10` caps simultaneous in-flight requests
- `runWithLimit<T>(fn)` queues tasks when the active count reaches the limit
- As each request completes (success or failure), the next queued task is dequeued and executed
- No external dependencies — the pool is a lightweight 20-line closure using a counter + queue array

| File | Change |
|------|--------|
| `src/components/RunCollectionModal.tsx` | Wrapped each parallel `executeRequest` call in `runWithLimit()`, limiting the maximum number of concurrent HTTP requests to 10. |

**Before:** 100 requests in parallel mode → 100 simultaneous HTTP connections, potential socket exhaustion, server throttling, and unpredictable timeouts.

**After:** At most 10 requests fly concurrently; remaining requests queue and execute as slots free up. All results still aggregated via `Promise.all`.

---

## #18 · Fix `exportFullStorage` nesting depth — `Fixed`

**Status:** ✅ Complete

**Problem:** The `exportFullStorage` function in `appStore.ts` only sanitized auth credentials for 2 levels of folder nesting (folder → subFolder). Any folder deeper than that would have raw secrets (passwords, tokens, API keys) leaked into the exported JSON.

**Root Cause:** The sanitization used a manual 2-level inline `.map()` chain instead of a recursive function:
```js
folders: collection.folders.map(folder => ({
  ...folder,
  auth: sanitizeAuth(folder.auth),
  folders: folder.folders.map(subFolder => ({   // ← only 2 levels!
    ...subFolder,
    auth: sanitizeAuth(subFolder.auth)
  }))
}))
```

**Solution:** Replaced the inline 2-level map with a recursive `sanitizeFolders` function:

```ts
const sanitizeFolders = (folders: any[]): any[] => {
  return folders.map((folder: any) => ({
    ...folder,
    auth: sanitizeAuth(folder.auth),
    folders: folder.folders ? sanitizeFolders(folder.folders) : [],
  }));
};
```

| File | Change |
|------|--------|
| `src/store/appStore.ts` | Extracted `sanitizeFolders()` recursive function; replaced the 2-level inline map with a single call to `sanitizeFolders(collection.folders)`. |

**Before:** `Collection > Folder A > Folder B > Folder C (Bearer token)` → Folder C's token exported as plaintext.

**After:** All folders at any depth have their auth credentials sanitized with placeholders (`{{token}}`, `{{password}}`, `{{apiKey}}`).

---

## #20 · Add IPC input validation — `Fixed`

**Status:** ✅ Complete

**Problem:** All `ipcMain.handle` callbacks blindly trusted renderer-supplied parameters. A compromised renderer process could send malformed types, oversized strings, path traversal payloads, or invalid values to any IPC channel.

**Solution:** Created a shared validation module `electron/ipc/validate.js` with type-safe validators:

| Validator | Purpose |
|-----------|---------|
| `requireString(value, name, maxLen)` | Non-empty string with length cap |
| `optionalString(value, name, maxLen)` | Nullable string with length cap |
| `requirePositiveInt(value, name, max)` | Positive integer with upper bound |
| `requireNonNegativeNumber(value, name, max)` | Non-negative number with upper bound |
| `requireObject(value, name)` | Plain object (not null, not array) |
| `requireArray(value, name, maxLen)` | Array with maximum element count |
| `requireSafeRelativePath(filepath, name)` | Blocks `..` traversal, absolute paths, null bytes |
| `requireDirectoryPath(value, name)` | Directory path string, blocks null bytes |
| `requireHttpMethod(value, name)` | Allowlist of standard HTTP methods |
| `requireUrl(value, name)` | Valid URL with length cap |
| `requireOneOf(value, name, allowed)` | Enum validation against an allowlist |

**Applied validation to all 5 handler modules:**

| Module | Key Validations Added |
|--------|----------------------|
| `httpHandler.js` | `requireUrl` on URL, `requireHttpMethod` on method, `optionalString` on requestId, `requireObject` on data |
| `secretsHandler.js` | `requireString` on content with 1 MB size cap for both `write-secrets` and `write-ai-secrets` |
| `aiHandler.js` | `requireOneOf` on provider, `requireArray` on messages, `optionalString` on apiKey/model/baseUrl, clamped temperature [0,2] and maxTokens [1,1M] |
| `workspaceHandler.js` | `requireObject` on preferences/config/data, `requireDirectoryPath` on oldPath/newPath/homeDirectory/secretsDirectory, `requireString` on workspaceId/name, array check on workspaces |
| `fileHandlers.js` | Already had `safePath()` traversal guard — no changes needed |

**Security gaps closed:**
- Workspace import: `homeDirectory` and `secretsDirectory` validated; `exportData` shape checked
- Data migration: Both source/destination paths validated
- HTTP proxy: Method restricted to standard HTTP methods; URL validated
- AI requests: Provider restricted to known values; numeric bounds enforced
- Secrets writes: Content size capped at 1 MB to prevent memory exhaustion

---

## #21 · Split giant components — `Implemented`

**Status:** ✅ Complete

**Problem:** Several components had grown too large for easy maintenance and navigation:
- `Sidebar.tsx` — 1,741 lines
- `RequestPanel.tsx` — 1,381 lines

**Extractions performed:**

### From Sidebar.tsx (1,741 → 1,029 lines, 41% reduction)

1. **`src/components/sidebar/HistoryPanel.tsx`** — History list with search, clear, and request-opening logic. Self-contained component with own store reads.

2. **`src/components/sidebar/SidebarContextMenu.tsx`** (~335 lines) — All three context menu types (collection, folder, request) with their actions (rename, delete, duplicate, move, export, run, auth config, sort). Reads store actions directly via `useAppStore`; takes only local-state setters as props.

3. **`src/components/sidebar/ApiDocsPanel.tsx`** (~255 lines) — API documents list with own DnD context (sensors, drag start/end handlers), own editing state, and all CRUD callbacks (add, rename, delete, convert format, generate collection, export). Parent passes `filteredApiDocuments` prop and `onResetSort` callback.

4. **`src/components/sidebar/types.ts`** — Added shared `ContextMenuState` interface for type-safe context menu state.

**Dead code removed from Sidebar.tsx:**
- `handleExportCollection` function (moved into SidebarContextMenu)
- API-doc branches from parent DnD handlers
- 9 unused icon imports (Play, Key, MoveRight, Copy, Settings, Download, FolderPlus, Trash2, Edit2)
- Unused store destructuring for deleted/moved actions
- Dead state variables (editingApiSpecId, editingApiSpecName, apiSpecInputRef)
- `exportToPostman`, `yaml`, `DEFAULT_OPENAPI_YAML`, `SortableApiDocItem` imports

### From RequestPanel.tsx (1,381 → 740 lines, 46% reduction)

1. **`src/components/request/BodyEditor.tsx`** (~165 lines) — Body type selector (none/json/raw/urlencoded/form-data) with internal `KeyValueTable` sub-component that deduplicates urlencoded and form-data table rendering. Interface: `{body, onChange}`.

2. **`src/components/request/AuthEditor.tsx`** (~165 lines) — Auth type selector (inherit/none/basic/bearer/api-key) with inherited auth display and all auth-type editors. Interface: `{auth, inheritedAuth, onChange}`.

3. **`src/components/request/ScriptsEditor.tsx`** (~135 lines) — Script editor with embedded `ScriptSnippetsPanel` component, all snippet data (PRE_SCRIPT_SNIPPETS, POST_SCRIPT_SNIPPETS), and own editor ref for cursor-based snippet insertion. Interface: `{type, value, onChange}`.

4. **`src/components/request/UrlBar.tsx`** (~155 lines) — URL bar with HTTP method selector, URL input with query param sync, send/cancel buttons, cURL import flash, and code generation dropdown. Manages own dropdown state. Interface: `{method, url, params, isLoading, curlImportFlash, onChange, onPaste, onSend, onCancel, onShowCode}`.

**Dead code removed from RequestPanel.tsx:**
- `renderBody()` function (~218 lines)
- `renderAuth()` function (~157 lines)
- `ScriptSnippetsPanel` component + `PRE/POST_SCRIPT_SNIPPETS` data (~163 lines)
- `preScriptEditorRef` and `postScriptEditorRef` refs
- `showCodeDropdown` state (moved into UrlBar)
- `HTTP_METHODS` constant (moved into UrlBar)
- `CodeEditor` and `CodeEditorHandle` imports
- 5 unused icon imports (Send, Code, ChevronDown, XCircle removed; Terminal kept for code modal)

**Architecture decisions:**
- Each extracted component reads its own store actions via `useAppStore` where possible, minimizing prop drilling
- DnD contexts are isolated per panel to avoid cross-contamination of drag events
- Shared state that crosses component boundaries (filter values, modal toggles) stays in the parent
- Internal sub-components (KeyValueTable, ScriptSnippetsPanel) are co-located with their parent extraction

---

## #22 · Add test coverage for critical paths — `Implemented`

**Status:** ✅ Complete

**Summary:** Added 6 new test files covering pure-function utility modules with 184 new test cases, bringing the total to **329 tests across 11 files** — all passing.

**New test files created:**

1. **`test/validate.test.ts`** (63 tests) — IPC input validation functions (security-critical)
   - Covers all 11 exported validators: `requireString`, `optionalString`, `requirePositiveInt`, `requireNonNegativeNumber`, `requireObject`, `requireArray`, `requireSafeRelativePath`, `requireDirectoryPath`, `requireHttpMethod`, `requireUrl`, `requireOneOf`
   - Tests valid inputs, boundary values, type coercion rejection, and error messages

2. **`test/variables.test.ts`** (24 tests) — Variable replacement engine
   - `replaceVariables`: environment priority, disabled variable filtering, `currentValue` precedence, collection-level overrides
   - `resolveRequestVariables`: URL, headers, params, JSON/raw/urlencoded/form-data body types, all auth types (basic, bearer, api-key), secret variable protection (`***`), immutability verification

3. **`test/request-tree.test.ts`** (25 tests) — Request tree CRUD operations
   - `findRequest`: nested lookup, missing ID returns undefined
   - `findAndUpdateRequest`: partial updates, nested targets, missing ID no-op
   - `findAndDeleteRequest`: root and nested deletion, missing ID no-op
   - `findAndUpdateFolder`: partial folder updates, nested targets
   - `findAndDeleteFolder`: root and nested deletion with children, missing ID no-op

4. **`test/curl-parser.test.ts`** (38 tests) — cURL command parser
   - Basic parsing: minimal GET, non-curl rejection, empty string handling
   - Methods: `-X`, `--request`, combined `-XDELETE`, auto-POST with body
   - Headers: single/multiple `-H`, `--header`, colon-in-value handling
   - Body: JSON with Content-Type, auto-detect JSON, urlencoded, `--data-urlencode`, `--data-raw`, multi `-d` concatenation
   - Form data: `-F`, `--form`, file references, multiple fields
   - Auth: `-u`/`--user` basic auth, password-less auth
   - Special flags: `-A` user-agent, `-e` referer, `-b` cookie, `--compressed`, ignored flags (-L/-k/-v/-s/-i)
   - URL handling: query param extraction to params array, port numbers
   - Real-world: complex POST with auth+JSON, GitHub API-style, header metadata validation

5. **`test/http-utils.test.ts`** (27 tests) — HTTP formatting utilities
   - `formatBytes`: 0, bytes, KB, MB, GB, undefined/null safety
   - `formatTime`: ms, seconds, minutes thresholds, boundary values
   - `getMethodColor`/`getMethodBgColor`: all HTTP methods + unknown fallback
   - `getStatusColor`: 2xx/3xx/4xx/5xx ranges + boundary
   - `prettyPrintJson`: formatting, invalid JSON passthrough, non-string passthrough
   - `isValidJson`: objects, arrays, primitives, invalid inputs

6. **`test/helpers.test.ts`** (14 tests) — Mustache-to-angle-bracket variable conversion
   - `convertMustacheToAngleBrackets`: single/multiple/nested vars, partial braces, empty/no-var strings
   - `convertMustacheVarsDeep`: string, array, nested object, mixed types, null/undefined/number passthrough

**Pre-existing test files (unchanged, all passing):**
- `test/postman.test.ts` (22 tests) — Postman collection import
- `test/hoppscotch.test.ts` (27 tests) — Hoppscotch collection import
- `test/bruno.test.ts` (43 tests) — Bruno collection import
- `test/import-drag-drop.test.ts` (23 tests) — Import format detection
- `test/empty-collection-new-request.test.ts` (23 tests) — Collection/request creation

**Architecture decisions:**
- Focused on pure-function modules that can be tested without DOM or Electron mocking
- `validate.js` is CommonJS (`module.exports`), tested via `require()` in the test file
- Tests verify actual parser behavior (e.g., `Authorization: Bearer` headers are extracted into `auth` object, URL query params are moved to `params` array by `new URL()` normalization)
- No new dependencies added — uses only Vitest globals already configured

---

## #23 · Handle binary/non-UTF-8 responses — `Implemented`

**Status:** ✅ Complete

**Problem:** All HTTP responses were forced to UTF-8 via `rawBuffer.toString('utf-8')` in the Electron main process HTTP handler. This corrupted binary data (images, PDFs, protobuf, etc.) and silently mis-decoded text in non-UTF-8 charsets.

**Changes made:**

1. **`src/types/index.ts`** — Added `bodyEncoding?: 'utf-8' | 'base64'` to `ApiResponse` interface. Updated `ElectronAPI.saveFile` signature to accept `content: string | number[]`, `defaultName?: string`, and `binary?: boolean`.

2. **`electron/ipc/httpHandler.js`** — Added content-type detection:
   - `isBinaryContentType(contentType)`: checks against known binary MIME prefixes (`image/`, `audio/`, `video/`, `font/`) and specific binary types (`application/octet-stream`, `application/pdf`, `application/zip`, `application/protobuf`, etc.)
   - `parseCharset(contentType)`: extracts charset from Content-Type and maps to Node.js Buffer-compatible encoding (`latin1` for ISO-8859-1/Windows-1252, `utf16le` for UTF-16LE, `ascii` for US-ASCII, etc.)
   - Binary responses are now base64-encoded: `rawBuffer.toString('base64')` with `bodyEncoding: 'base64'`
   - Text responses respect declared charset: `rawBuffer.toString(charset)` with `bodyEncoding: 'utf-8'`

3. **`electron/ipc/fileHandlers.js`** — Updated `save-file` handler to support binary mode. When `binary: true` and `content` is a number array, writes as `Buffer.from(content)` instead of UTF-8 text. Also uses `defaultName` fallback for `defaultPath`.

4. **`src/utils/httpClient.ts`** — Updated `capResponseBody` to handle base64-encoded responses. For binary bodies, uses the 3/4 ratio to estimate decoded size, and truncates at valid base64 boundaries (multiples of 4 characters).

5. **`src/components/ResponsePanel.tsx`** — Complete binary response rendering:
   - **Images** (`image/*`): Rendered inline as `<img>` with base64 data URI, plus file info and "Save Image" button
   - **Other binary types**: Shows a "Binary Response" placeholder with file type, size, and "Save to File" button
   - **Copy handler**: For binary responses, copies a descriptive placeholder (`[Binary response: 1.5 KB, image/png]`) since raw bytes aren't useful on clipboard
   - **Save handler**: Decodes base64 to `Uint8Array` and saves as proper binary, both via Electron native dialog and browser fallback
   - Added `useMemo` for data URI construction, file extension inference, and content-type parsing

**Architecture decisions:**
- Base64 encoding for binary IPC transport: chosen because Electron's IPC uses structured clone, which handles strings but not raw Buffers efficiently across process boundaries
- Charset mapping uses only Node.js native Buffer encodings (utf-8, latin1, ascii, utf16le, ucs2) — no external dependency like `iconv-lite`
- `latin1` is used as a reasonable approximation for `windows-1252` and `iso-8859-1`, covering the vast majority of non-UTF-8 Western text
- Post-scripts on binary responses receive the raw base64 string in the catch branch of `JSON.parse`, which is acceptable (scripts rarely process binary data)

---

## #24 · Support FormData through Electron IPC — `Implemented`

**Status:** ✅ Complete

**Problem:** When body type was `form-data`, the renderer built a browser `FormData` object, but the IPC call sent `body: typeof body === 'string' ? body : undefined`, which evaluated to `undefined` for FormData instances. Multipart form requests in Electron mode silently sent no body.

**Changes made:**

1. **`src/utils/httpClient.ts`** — Before the IPC call, checks if `body instanceof FormData`. If so, serialises entries to `formDataEntries: Array<{ key: string; value: string }>` and passes as `formData` in the IPC payload alongside the existing `body: undefined`.

2. **`src/types/index.ts`** — Added `formData?: Array<{ key: string; value: string }>` to the `ElectronAPI.httpRequest` parameter type.

3. **`electron/ipc/httpHandler.js`**:
   - Added `buildMultipartBody(entries)` function that constructs a proper RFC 2046-compliant multipart body with a unique boundary string, correctly escaping field names and encoding as UTF-8 Buffer.
   - Updated the request-writing section: when `formData` array is provided, calls `buildMultipartBody`, sets `Content-Type` with boundary, sets `Content-Length`, and writes the multipart buffer. Falls back to the existing plain-string body write otherwise.
   - Destructures `formData` from the validated `data` object alongside `sslVerification` and `body`.

**Architecture decisions:**
- Serialisation uses a simple `Array<{ key, value }>` structure rather than re-encoding into a FormData-like format, since Electron IPC uses structured clone and cannot handle `FormData` objects
- Multipart body is constructed manually in the main process using a random boundary — no external dependency (like `form-data` npm package)
- `Content-Length` is set explicitly to ensure proper streaming to the upstream server
- File uploads via `form-data` are not yet supported (values are always strings); file support would require additional IPC handling for binary file content

---

## #25 · Add corporate proxy support — `Implemented`

**Status:** ✅ Complete

**Problem:** Users behind corporate proxies could not use Fetchy because HTTP requests from the main process did not support proxy configuration or respect `HTTP_PROXY`/`HTTPS_PROXY` environment variables.

**Changes made:**

1. **`src/types/index.ts`** — Added `ProxySettings` interface with `mode` ('none' | 'system' | 'manual'), `url`, `username`, `password` fields. Added optional `proxy?: ProxySettings` to `AppPreferences`.

2. **`src/store/preferencesStore.ts`** — Added `proxy: { mode: 'system', url: '' }` to `defaultPreferences` so existing installations default to system/env-var mode.

3. **`src/components/SettingsModal.tsx`** — Added "Proxy Settings" section to the General tab:
   - Mode selector: "No Proxy", "System / Environment", "Manual"
   - Manual mode reveals: Proxy URL input (with placeholder), Username and Password fields (optional)
   - System mode shows explanatory text about HTTP_PROXY/HTTPS_PROXY env vars

4. **`electron/ipc/httpHandler.js`**:
   - Renamed `_deps` to `deps` and wired `deps.loadPreferences()` for live proxy resolution
   - Added `resolveProxy()` function: reads proxy settings from preferences, falls back to env vars for 'system' mode, supports authenticated proxies
   - Added `connectTunnel(proxyUrl, targetHost, targetPort)` for HTTPS-through-HTTP-proxy using CONNECT tunneling with 15s timeout and Proxy-Authorization header
   - For HTTP targets: routes through proxy by setting hostname/port to proxy and using full URL as path
   - For HTTPS targets: opens CONNECT tunnel to proxy, then passes the raw socket to the HTTPS request
   - Proxy errors are surfaced as a clear "Proxy Error" statusText

**Architecture decisions:**
- Default mode is 'system' so existing installations automatically pick up corporate proxy env vars without configuration
- No external dependency (e.g. `global-agent`, `https-proxy-agent`) — uses native Node.js HTTP CONNECT method
- Proxy credentials are stored in preferences.json (not encrypted) — acceptable for corporate proxy passwords which are typically domain credentials, not API secrets
- CONNECT tunnel timeout (15s) is separate from the request timeout (30s)

---

## #26 · Normalize data model — `Implemented`

**Status:** ✅ Complete

**Problem:** Recursive tree traversal with full copy-on-write on every mutation was O(n) for the entire tree. Every `findRequest`, `findAndUpdateRequest`, `findAndDeleteRequest`, `findAndUpdateFolder`, `findAndDeleteFolder`, `addRequestToFolder`, and `addSubFolder` call required scanning the full tree, and the immutable update pattern created new array copies at every level of the recursion path.

**Solution:** Introduced a **normalized entity index** (`EntityIndex`) that maintains flat `Map<id, EntityLocation>` lookup tables alongside the existing collection tree. All store mutations now use O(1) index lookups followed by O(depth) direct navigation, replacing the previous O(n) full-tree recursive scans. The tree structure is preserved for rendering and persistence backward compatibility.

**Files Created:**
- `src/store/entityIndex.ts` — New module (235 lines) providing:
  - `EntityIndex` type with `requests` and `folders` Maps
  - `buildEntityIndex(collections)` — builds complete index from collection tree
  - `reindexCollection(index, collection)` — re-indexes a single collection
  - `removeCollectionFromIndex(index, id)` — removes all entries for a collection
  - `indexRequest()` / `indexFolder()` — incremental additions
  - `unindexRequest()` / `unindexFolder()` — incremental removals (recursive for folders)
  - `getAncestorChain(index, folderId)` — builds parent chain from index
  - `navigateToFolder(collection, index, folderId)` — O(depth) direct navigation
  - `getRequestContainer(collections, index, requestId)` — finds the container holding a request
  - `getFolderContainer(collections, index, folderId)` — finds the container holding a folder
- `test/entity-index.test.ts` — 36 tests covering all index operations

**Files Modified:**
- `src/types/index.ts` — Added optional `parentId?: string` and `parentType?: 'collection' | 'folder'` fields to both `ApiRequest` and `RequestFolder` interfaces (backward-compatible additions)
- `src/store/appStore.ts` — Major refactor of all collection/folder/request actions:
  - Added `_entityIndex: EntityIndex` field (excluded from persistence via `partialize`)
  - Added `_rebuildIndex()` action for full index reconstruction
  - Updated 12 actions (`addFolder`, `updateFolder`, `deleteFolder`, `toggleFolderExpanded`, `reorderFolders`, `moveFolder`, `addRequest`, `updateRequest`, `deleteRequest`, `duplicateRequest`, `reorderRequests`, `moveRequest`) to use index-accelerated O(1) lookups with legacy fallback
  - Updated `importCollection` and `importFullStorage` to rebuild index after data changes
  - Added `onRehydrateStorage` callback to rebuild index on store rehydration
  - Updated `rehydrateWorkspace` to call `_rebuildIndex()` after rehydrate
- `src/utils/authInheritance.ts` — Updated `buildAncestorPath` and `resolveInheritedAuth` to accept optional `EntityIndex` parameter for O(1) parent chain resolution

**Performance Improvements:**
- `findRequest` / `getRequest`: O(n) → O(1) via index lookup + O(depth) navigation
- `updateRequest` / `deleteRequest`: O(n) recursion + O(n) array copies → O(1) lookup + O(depth) navigation + direct mutation via immer
- `addRequest` / `addFolder`: O(n) recursive search for parent → O(1) lookup + O(depth) navigation
- `toggleFolderExpanded`: O(n) full tree map → O(1) lookup + O(depth) navigation + single property mutation
- `reorderRequests` / `reorderFolders`: O(n) recursive map → O(1) lookup + O(depth) navigation + array splice
- `moveRequest` / `moveFolder`: O(2n) find + delete recursion → O(1) lookup + splice + re-index
- Auth inheritance: O(n²) recursive ancestor scan → O(depth) parent pointer chain walk

**Design Decisions:**
- **Adapter pattern**: Index lives alongside the tree rather than replacing it, avoiding a risky big-bang migration of the 30+ files that consume the tree structure
- **Legacy fallback**: Every indexed operation falls back to the original recursive function if the index returns null (e.g., during initial load before index is built), ensuring zero-downtime transitions
- **Not persisted**: `_entityIndex` is excluded from `partialize` and rebuilt on every rehydrate/import — the index is cheap to rebuild (single tree scan) and avoiding persistence means zero migration risk
- **Incremental maintenance**: Add/delete operations update the index incrementally rather than doing a full rebuild, keeping mutations efficient
- **Same external API**: `requestTree.ts` pure functions are unchanged — all 25 existing tests pass. UI components, import/export parsers, and persistence layer require zero changes.

**Test Results:** 12 files, 365 tests, 0 failures (36 new entity-index tests + 329 existing tests)

---

## #27 · Eliminate duplicated persistence logic — `Implemented`

**Status:** ✅ Complete

**Problem:** Both the Electron split-file storage adapter and the browser localStorage adapter duplicated the same four transformations:
1. History response body truncation (MAX_BODY_SIZE = 5000)
2. Transient environment variable stripping (`stripTransientEnvValues`)
3. Secret extraction (`extractSecrets`) on write
4. Secret merging (`mergeSecrets`) on read

Any change to the write/read pipeline required updating two code paths in parallel, risking divergence and subtle bugs.

**Solution:** Extracted two composable pipeline functions:
- `prepareForWrite(stateWrapper)` — runs history truncation → strip transient values → extract secrets. Returns `{ cleanState, secretsMap }`.
- `hydrateAfterRead(stateWrapper, secretsMap)` — runs merge secrets → strip transient values. Returns hydrated state wrapper.

Both storage adapters (Electron and browser) now call these shared functions instead of inlining the logic.

**Files Modified:**
- `src/store/persistence.ts` — Added `prepareForWrite()` and `hydrateAfterRead()` pipeline functions (exported for testability). Extracted `MAX_HISTORY_BODY_SIZE` constant. Refactored Electron `setItem` to use `prepareForWrite`, Electron `getItem` to use `hydrateAfterRead`, browser `setItem` to use `prepareForWrite`, browser `getItem` to use `hydrateAfterRead`. Removed ~40 lines of duplicated inline logic.

**Design Decisions:**
- Pipeline functions are exported for future testability but currently used only internally
- `hydrateAfterRead` gracefully handles missing secrets (falls back to plain `stripTransientEnvValues`)
- No behavioral change — only structural deduplication; identical output before and after refactoring

**Test Results:** 12 files, 365 tests, 0 failures

---

## #28 · Add data format migration system — `Implemented`

**Status:** ✅ Complete

**Problem:** Exports carried a hardcoded `version: "1.0"` with no migration handler for schema changes. When the persisted data shape evolves (new fields, renamed properties, structural changes), existing user data would silently fail or lose information without a systematic migration mechanism.

**Solution:** Created a version-aware migration chain system in `src/store/dataMigration.ts` with three public APIs:
- `migrateState(stateWrapper)` — migrates Zustand state wrappers loaded from persistence (both Electron and browser paths)
- `migrateExport(data)` — migrates `AppStorageExport` objects used by import/export
- `detectVersion(state)` — detects schema version from explicit version field or heuristic inspection

**Migration Chain Architecture:**
- Migrations are registered as ordered `{ from, to, migrate }` entries
- Each `MigrationFn` is a pure function transforming state from version N to N+1
- Migrations apply sequentially (e.g. 1.0 → 1.1 → 1.2) to reach `CURRENT_SCHEMA_VERSION`
- Adding a new migration requires only: (1) write the migration function, (2) add entry to the `migrations` array, (3) bump `CURRENT_SCHEMA_VERSION`

**v1.0 → v1.1 Migration:**
- Ensures every collection has `auth` defaulting to `{ type: 'none' }`
- Ensures every request (including in nested folders) has `sslVerification` defaulting to `true`
- Preserves existing values — only fills in missing defaults

**Integration Points:**
- `src/store/persistence.ts` — Both Electron and browser `getItem` paths call `migrateState()` after hydration, before returning to Zustand
- `src/store/appStore.ts` — `importFullStorage` calls `migrateExport()` on incoming data before applying to state
- `src/store/appStore.ts` — `exportFullStorage` uses `CURRENT_SCHEMA_VERSION` instead of hardcoded `'1.0'`

**Files Created:**
- `src/store/dataMigration.ts` — Migration registry, detection, and execution engine (~160 lines)
- `test/data-migration.test.ts` — 27 tests covering detectVersion, migrateState, migrateExport, chain integrity, edge cases

**Files Modified:**
- `src/store/persistence.ts` — Added import for `migrateState`, called after hydration in both Electron and browser `getItem` paths
- `src/store/appStore.ts` — Added imports for `migrateExport` and `CURRENT_SCHEMA_VERSION`. Updated `exportFullStorage` to use `CURRENT_SCHEMA_VERSION`. Updated `importFullStorage` to run `migrateExport()` before applying data.

**Design Decisions:**
- Pure function migrations (no side effects) for easy testability and reasoning
- `detectVersion` uses both explicit version fields and heuristic shape-checking for backward compatibility with state wrappers that use Zustand's internal `version: 0` (number)
- Migration functions operate on inner state (not the wrapper), keeping the Zustand wrapper structure intact
- Console logging of migration steps for observability in development

**Test Results:** 13 files, 392 tests, 0 failures

---

## #29 · Upgrade Vite + Electron — `Implemented`

**Status:** ✅ Complete

**Problem:** Vite 4.5.3 was at end-of-life status without receiving security patches. Electron 40.0.0 was missing 6 months of security patches and bug fixes. @vitejs/plugin-react 4.2.1 was significantly behind the latest compatible version.

**Solution:** Upgraded all packages to their latest compatible versions within the current Node.js (v16) constraint:

| Package | Before | After | Change |
|---------|--------|-------|--------|
| vite | 4.5.3 | **4.5.14** | +11 patch versions (security fixes) |
| electron | 40.0.0 | **40.6.1** | +6 minor/patch versions (security + bug fixes) |
| @vitejs/plugin-react | 4.2.1 | **4.7.0** | +5 minor versions (new features + fixes) |
| vitest | 0.34.6 | 0.34.6 | No change (locked to Vite 4 compatibility) |

**Additional Changes:**
- Added `engines` field to `package.json` documenting minimum Node.js (>=16.15.0) and npm (>=8.0.0) requirements
- Fixed pre-existing literal `\n` in Sidebar.tsx import line (line 40) that caused TypeScript compilation errors

**Node.js Upgrade Path (documented for future):**
To fully reach Vite 6+ (current roadmap target), Node.js must be upgraded:
- Vite 5.x requires Node 18+
- Vite 6.x requires Node 20+
- Vitest 1.x+ requires Vite 5+
Once Node 20+ is available, update: `vite@^6`, `vitest@^3`, `@vitejs/plugin-react@^5`

**Files Modified:**
- `package.json` — Updated vite, electron, @vitejs/plugin-react version ranges; added `engines` field
- `src/components/Sidebar.tsx` — Fixed pre-existing literal `\n` in import line

**Test Results:** 13 files, 392 tests, 0 failures

---

## #30 · Add lint/format tooling — `Implemented`

**Status:** ✅ Complete

**Problem:** No ESLint or Prettier configuration existed. Code style was enforced only by convention, leading to inconsistent formatting and no automated detection of common bugs (unused variables, missing React hook dependencies, undefined JSX components, etc.).

**Solution:** Installed and configured ESLint 8 + Prettier 3 with TypeScript and React support.

**Packages Installed (devDependencies):**
| Package | Version | Purpose |
|---------|---------|---------|
| eslint | ^8.57.0 | Core linter |
| @typescript-eslint/eslint-plugin | ^6.21.0 | TypeScript rules |
| @typescript-eslint/parser | ^6.21.0 | TypeScript parser |
| eslint-plugin-react | ^7.34.0 | React-specific rules |
| eslint-plugin-react-hooks | ^4.6.0 | Hooks rules (exhaustive-deps, rules-of-hooks) |
| prettier | ^3.2.0 | Code formatter |
| eslint-config-prettier | ^9.1.0 | Disables ESLint rules that conflict with Prettier |

**Configuration Files Created:**
- `.eslintrc.json` — ESLint config extending recommended rulesets for TS + React + Prettier. Key customizations: `@typescript-eslint/no-explicit-any: off` (codebase uses any in store/persistence), unused vars use `^_` ignore pattern, React JSX runtime (no React import needed), pre-existing patterns (empty catch, unescaped entities) set to `warn` for gradual adoption
- `.prettierrc` — Prettier config: single quotes, 2-space tabs, trailing commas, 100 char print width, auto line endings
- `.prettierignore` — Excludes dist/, release/, build/, node_modules/, docs/build/

**NPM Scripts Added:**
- `npm run lint` — Run ESLint on src/ and test/
- `npm run lint:fix` — Run ESLint with auto-fix
- `npm run lint:strict` — Run ESLint with `--max-warnings 0` (for CI)
- `npm run format` — Format all source files with Prettier
- `npm run format:check` — Check formatting without modifying files (for CI)

**Pre-existing Bugs Fixed During Lint Audit:**
- `src/components/Sidebar.tsx` — Added missing `ChevronUp` import from lucide-react (was `react/jsx-no-undef` error)
- `src/utils/authInheritance.ts` — Merged duplicate imports from `../store/entityIndex`
- `src/utils/httpClient.ts` — Changed `let preScriptOutput` to `const` (never reassigned)
- `src/store/persistence.ts` — Renamed unused destructured `currentValue` to `_cv`
- `test/postman.test.ts` — Merged duplicate imports from `../src/utils/postman`
- `test/validate.test.ts` — Added `eslint-disable-next-line` for intentional CJS `require()`

**Lint Results After Setup:** 0 errors, 38 warnings (all warnings are pre-existing patterns in component code that can be addressed incrementally)

**Test Results:** 13 files, 392 tests, 0 failures

---

## #31 · Eliminate circular `require()` — `Implemented`

**Status:** ✅ Complete

**Problem:** `persistence.ts` contained a dynamic `require('./workspacesStore')` call that created a circular dependency chain: `persistence.ts` → `workspacesStore.ts` → `appStore.ts` → `persistence.ts`. While the dynamic `require()` worked at runtime, it was fragile, caused ESLint `no-var-requires` errors, and could break under module bundler optimizations.

**Solution:** Removed the circular dependency by eliminating the git auto-sync feature entirely. The `triggerGitAutoSync()` function and `registerGitSyncProvider()` callback pattern were the sole reason for the cross-store dependency. With git features removed from the application, the dynamic `require()` and all associated code were deleted.

**Dependency Direction (after):**
- `persistence.ts` → `workspacesStore.ts` — **removed entirely**
- No circular dependency exists

**Files Modified:**
- `src/store/persistence.ts` — Removed `triggerGitAutoSync()`, `registerGitSyncProvider()`, `_gitSyncInfoProvider`, and `GitSyncInfo` interface
- `src/store/workspacesStore.ts` — Removed `registerGitSyncProvider` import and registration call

**Test Results:** 13 files, 392 tests, 0 failures

---
