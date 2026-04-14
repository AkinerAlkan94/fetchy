# Fetchy REST Client — Product Feature Demand Backlog

> **Created:** April 10, 2026
> **Purpose:** Comprehensive feature demand list for prioritization and elimination
> **Role:** Product Manager perspective — market gaps, differentiators, and growth levers

---

## How to Use This File

- **Status options:** `⬜ Candidate` | `✅ Accepted` | `🚀 In Progress` | `✔️ Done` | `❌ Eliminated`
- Score each item, eliminate what doesn't fit, and move accepted items to implementation plans
- The **Top 15 Game-Changers** section at the bottom highlights the highest-impact picks

---

## 1. PROTOCOL EXPANSION — "Beyond REST"

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1.1 | **GraphQL Query Builder & Explorer** | Schema introspection, auto-complete, query/mutation builder, variables panel. GraphQL is everywhere — Postman & Insomnia both have it. | ⬜ Candidate |
| 1.2 | **WebSocket Client** | Connect, send/receive messages, message log, reconnect. Critical for real-time API dev (chat, notifications, trading). | ⬜ Candidate |
| 1.3 | **gRPC Client** | Proto file import, service browser, unary + streaming calls. Growing enterprise demand. | ⬜ Candidate |
| 1.4 | **Server-Sent Events (SSE) Client** | Connect to SSE endpoints, display streaming events in real-time. Increasingly used for AI streaming responses. | ⬜ Candidate |
| 1.5 | **MQTT Client** | IoT and event-driven architectures are growing. Lightweight pub/sub testing. | ⬜ Candidate |
| 1.6 | **Socket.IO Client** | Dedicated Socket.IO support (not just raw WS) — hugely used in Node.js ecosystem. | ⬜ Candidate |

---

## 2. TESTING & QUALITY — "Shift-Left Testing"

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 2.1 | **Test Assertions UI with Pass/Fail Results** | `fetchy.test("name", () => {...})` wrapper with visual test results tab showing green/red pass/fail counts. Currently scripts run but no structured test reporting. | ⬜ Candidate |
| 2.2 | **Data-Driven Testing (CSV/JSON)** | Import a CSV/JSON data file, iterate collection runner over each row. Unlocks bulk/parameterized testing. | ⬜ Candidate |
| 2.3 | **Response Snapshot Testing** | Save a "golden" response, auto-compare future responses against it. Detect regressions instantly. | ⬜ Candidate |
| 2.4 | **API Contract Testing** | Validate responses against OpenAPI schema. "Does my API actually match the spec?" | ⬜ Candidate |
| 2.5 | **Test Reports (HTML/PDF/JUnit XML)** | Export collection runner results as sharable reports. Essential for CI pipelines and QA teams. | ⬜ Candidate |
| 2.6 | **Visual Response Diff** | Side-by-side diff between two responses (history items, snapshot vs. current). | ⬜ Candidate |
| 2.7 | **Response Time Trend Charts** | Track response time over multiple runs. Visualize performance degradation. | ⬜ Candidate |
| 2.8 | **Load/Stress Testing (Lite)** | Fire N concurrent requests at an endpoint with basic metrics (p50/p95/p99, throughput, error rate). Not full JMeter, but "developer-friendly quick load test." | ⬜ Candidate |
| 2.9 | **Chained Request Workflows** | Define request sequences with data passing: Response A → extract token → inject into Request B. Visual workflow builder. | ⬜ Candidate |
| 2.10 | **Request Retry with Backoff** | Configurable retry policy (count, backoff strategy) for flaky endpoints. | ⬜ Candidate |

---

## 3. AI-POWERED INNOVATION — "AI-Native API Client"

> *This is Fetchy's strongest differentiator. Lean hard into it.*

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 3.1 | **AI Chat Mode (Multi-Turn Conversation)** | Currently AI is single-turn. Add conversational context: "Now modify that script to also check response time" — huge UX upgrade. | ⬜ Candidate |
| 3.2 | **AI-Powered Test Generation** | Given a request+response, AI auto-generates comprehensive test assertions. "Generate tests for this endpoint." | ⬜ Candidate |
| 3.3 | **AI API Explorer / Natural Language Querying** | "Show me all endpoints that return user data" or "Find the endpoint to create an order" — AI searches collections semantically. | ⬜ Candidate |
| 3.4 | **AI Response Anomaly Detection** | AI learns "normal" responses and flags anomalies: unexpected fields, schema changes, status code shifts. | ⬜ Candidate |
| 3.5 | **AI-Powered Mock Server Generation** | Given an OpenAPI spec or collection, AI generates realistic mock responses with dynamic data. | ⬜ Candidate |
| 3.6 | **AI Request Auto-Complete** | As you type a URL, AI suggests endpoints, headers, body structure based on workspace context. | ⬜ Candidate |
| 3.7 | **AI Environment Setup Wizard** | "Help me configure environments for dev/staging/prod" — AI reads your collections and suggests variables to extract. | ⬜ Candidate |
| 3.8 | **AI cURL/Code Interpreter** | Paste any code snippet (JS fetch, Python requests, etc.) and AI converts it to a Fetchy request. Reverse code-gen. | ⬜ Candidate |
| 3.9 | **AI-Powered API Documentation Site** | AI generates full API documentation site from collection (not just markdown, but hosted HTML docs). | ⬜ Candidate |
| 3.10 | **AI Security Scanner** | AI analyzes requests/responses for security issues: exposed tokens in responses, missing auth headers, CORS misconfigurations, sensitive data in URLs. | ⬜ Candidate |
| 3.11 | **AI Smart Variable Extraction** | AI scans responses and suggests "You should extract this token/ID as a variable for reuse." | ⬜ Candidate |
| 3.12 | **AI Collection Organizer** | AI suggests folder structure, grouping, naming improvements for messy collections. | ⬜ Candidate |
| 3.13 | **AI Request Description Writer** | Auto-generate descriptions for all requests in a collection based on URL patterns and response shapes. | ⬜ Candidate |
| 3.14 | **AI Diff Explainer** | When response changes between runs, AI explains what changed and why it might matter. | ⬜ Candidate |

---

## 4. COLLABORATION & TEAM FEATURES — "Team-Ready"

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 4.1 | **Git-Based Collection Sync** | Store collections as individual files in a Git repo. Teams collaborate via Git (branch, PR, merge). Bruno does this — massive differentiator for privacy-first tool. | ⬜ Candidate |
| 4.2 | **File-Per-Request Storage Format** | Instead of one giant JSON, store each request as its own file (like Bruno .bru files). Enables meaningful Git diffs. | ⬜ Candidate |
| 4.3 | **Collection Conflict Resolution UI** | When multiple team members edit the same collection, show merge conflict UI (mergeConflict.ts already exists in codebase). | ⬜ Candidate |
| 4.4 | **Shared Environment Vaults** | Team-level environment files (committed to Git) with local-only secrets overlay. | ⬜ Candidate |
| 4.5 | **Request Comments & Annotations** | Add notes/comments to individual requests. Team communication inline. | ⬜ Candidate |
| 4.6 | **Change History / Audit Log** | Track who changed what, when. Local Git integration for collection versioning. | ⬜ Candidate |
| 4.7 | **Collection Branching** | Create "branches" of a collection to experiment without affecting the main version. | ⬜ Candidate |
| 4.8 | **Real-Time Collaboration (P2P)** | WebRTC-based peer-to-peer workspace sharing. No server needed — fits privacy-first ethos. | ⬜ Candidate |

---

## 5. DEVELOPER EXPERIENCE — "Power User Delight"

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 5.1 | **OAuth 2.0 Flow Wizard** | Visual OAuth 2.0 workflow: Authorization Code, Client Credentials, PKCE, Implicit, Device Code. Auto-token refresh. Postman has this — huge gap. | ⬜ Candidate |
| 5.2 | **Certificate Management UI** | Import/manage client certificates (mTLS). Assign certs per domain/collection. Enterprise must-have. | ⬜ Candidate |
| 5.3 | **Global Variables** | Workspace-wide variables (above environment level). Currently only env + collection vars exist. | ⬜ Candidate |
| 5.4 | **Dynamic Variables / Faker** | Built-in `<<$randomEmail>>`, `<<$timestamp>>`, `<<$guid>>`, `<<$randomName>>` etc. Postman has this — very popular. | ⬜ Candidate |
| 5.5 | **Request Pinning / Favorites** | Pin frequently-used requests to top of sidebar or a "favorites" bar. | ⬜ Candidate |
| 5.6 | **Multi-Tab Response Comparison** | Open two response tabs side-by-side for comparison. | ⬜ Candidate |
| 5.7 | **Configurable Request Timeouts** | Per-request timeout override (currently hardcoded 30s). | ⬜ Candidate |
| 5.8 | **Response Body Search (Ctrl+F)** | Full text search within response body. Essential for large responses. | ⬜ Candidate |
| 5.9 | **Request Duplication Across Collections** | Currently can only duplicate within same collection. Allow copy/move across collections. | ⬜ Candidate |
| 5.10 | **Bulk Edit All Requests** | Find-and-replace across all requests in a collection (e.g., change base URL from staging to prod). | ⬜ Candidate |
| 5.11 | **Request Tags / Labels** | Tag requests with custom labels (e.g., "regression", "smoke", "critical"). Filter sidebar by tags. | ⬜ Candidate |
| 5.12 | **Command Palette (Ctrl+K)** | Quick-access command palette like VS Code. Search requests, switch environments, run actions. | ⬜ Candidate |
| 5.13 | **Split Pane for Parallel Request Editing** | Side-by-side editing of two requests simultaneously. | ⬜ Candidate |
| 5.14 | **Request Dependency Visualization** | Visual graph showing which requests feed variables into other requests. | ⬜ Candidate |
| 5.15 | **URL Auto-Completion** | Suggest URLs from history and collection as you type. | ⬜ Candidate |
| 5.16 | **Header Auto-Completion** | Suggest common HTTP headers (Content-Type, Authorization, etc.) with values. | ⬜ Candidate |
| 5.17 | **Cookie Manager** | View, edit, delete cookies per domain. Auto-attach cookies to requests. | ⬜ Candidate |
| 5.18 | **Response Header Tooltips** | Explain what each response header means on hover (e.g., "X-RateLimit-Remaining: You have 42 requests left"). | ⬜ Candidate |

---

## 6. ENTERPRISE & SECURITY — "Enterprise-Grade"

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 6.1 | **SSO/SAML Integration** | For enterprise workspace access control (even if local, can gate features). | ⬜ Candidate |
| 6.2 | **Role-Based Access (Local)** | Read-only vs. editor roles for shared collection files. | ⬜ Candidate |
| 6.3 | **Request Audit Trail Export** | Export full audit log of all requests sent (compliance requirement). | ⬜ Candidate |
| 6.4 | **Secret Rotation Alerts** | Warn when tokens/keys haven't been rotated in X days. | ⬜ Candidate |
| 6.5 | **Data Loss Prevention (DLP)** | Warn before exporting collections containing secrets/tokens. Partially exists via auth sanitization, needs expansion. | ⬜ Candidate |
| 6.6 | **Automatic PII Detection** | Scan responses for PII (emails, SSNs, credit cards) and warn. | ⬜ Candidate |
| 6.7 | **Request Signing (AWS SigV4, HMAC)** | Built-in support for AWS Signature V4, HMAC signing. Another major auth gap. | ⬜ Candidate |
| 6.8 | **Mutual TLS (mTLS)** | Client certificate auth for zero-trust environments. | ⬜ Candidate |
| 6.9 | **Compliance Report Generation** | Generate API compliance reports (HIPAA, GDPR data handling). | ⬜ Candidate |

---

## 7. INTEGRATION ECOSYSTEM — "Plug Into Everything"

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 7.1 | **CLI Tool (fetchy-cli)** | Run collections from terminal/CI pipeline: `fetchy run --collection myapi.json --env prod`. Mission-critical for CI/CD. | ⬜ Candidate |
| 7.2 | **VS Code Extension** | Browse & run Fetchy collections from VS Code sidebar. | ⬜ Candidate |
| 7.3 | **GitHub Actions Integration** | Publish `fetchy-action` to marketplace for running API tests in CI. | ⬜ Candidate |
| 7.4 | **Slack/Teams/Discord Notifications** | Send collection run results to chat channels. | ⬜ Candidate |
| 7.5 | **Plugin/Extension System** | Allow community to build plugins (custom auth providers, response transformers, export formats). | ⬜ Candidate |
| 7.6 | **Swagger Hub / API Gateway Integration** | Pull API specs from popular API management platforms. | ⬜ Candidate |
| 7.7 | **Database Connection (Query Viewer)** | Send a request, then query a database to verify side effects. Developer workflow shortcut. | ⬜ Candidate |
| 7.8 | **Confluence/Notion Export** | Export API docs directly to wiki platforms. | ⬜ Candidate |
| 7.9 | **GitHub/GitLab Issue Creation** | Like Jira integration, but for GitHub Issues and GitLab Issues. | ⬜ Candidate |
| 7.10 | **Webhook Trigger for Collection Runs** | Expose local HTTP endpoint that triggers collection run on hit. | ⬜ Candidate |

---

## 8. MOCK SERVER & API DESIGN — "Design-First"

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 8.1 | **Built-in Mock Server** | Generate mock responses from OpenAPI spec or examples. Run locally. Frontend devs can work without backend. | ⬜ Candidate |
| 8.2 | **Request Examples** | Save multiple example request/response pairs per endpoint (like Postman). | ⬜ Candidate |
| 8.3 | **OpenAPI Spec Editor (Full)** | Visual OpenAPI editor: add endpoints, define schemas, preview docs. Currently only read/import support. | ⬜ Candidate |
| 8.4 | **API Design-First Workflow** | Design API spec → generate mock → test → switch to real server. Complete lifecycle. | ⬜ Candidate |
| 8.5 | **Response Templating** | Define response templates with dynamic data (Handlebars/Mustache) for mock scenarios. | ⬜ Candidate |
| 8.6 | **Schema Validation Viewer** | Show which response fields match/violate the OpenAPI schema, visually highlighted. | ⬜ Candidate |

---

## 9. MONITORING & OBSERVABILITY — "Beyond One-Shot Requests"

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 9.1 | **API Monitors (Scheduled Runs)** | Schedule collection runs every N minutes. Local cron-like monitoring. Desktop notifications on failure. | ⬜ Candidate |
| 9.2 | **Response Time Dashboard** | Historical charts: response time trends, error rates, uptime per endpoint. | ⬜ Candidate |
| 9.3 | **Endpoint Health Status** | Green/yellow/red indicator per request based on last N runs. | ⬜ Candidate |
| 9.4 | **Alert Rules** | Define rules: "If /api/health takes > 2s or returns non-200, notify me." | ⬜ Candidate |
| 9.5 | **Performance Benchmarking** | Run request N times, show min/max/avg/p95/p99 with histogram. | ⬜ Candidate |

---

## 10. IMPORT/EXPORT & INTEROP — "No Lock-In"

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 10.1 | **Export to Bruno Format** | Two-way interop with Bruno (currently import-only). | ⬜ Candidate |
| 10.2 | **Export to Hoppscotch Format** | Two-way interop. | ⬜ Candidate |
| 10.3 | **Export to Insomnia Format** | Capture Insomnia migrators. | ⬜ Candidate |
| 10.4 | **Export to HAR Format** | HTTP Archive format for performance analysis tools. | ⬜ Candidate |
| 10.5 | **Import from Insomnia** | Another major competitor migration path. | ⬜ Candidate |
| 10.6 | **Import from Thunder Client** | VS Code Thunder Client users are a prime audience. | ⬜ Candidate |
| 10.7 | **Selective Request Export** | Export specific requests, not just full collections. | ⬜ Candidate |
| 10.8 | **Environment-Only Import/Export** | Import/export environments separately from collections. | ⬜ Candidate |
| 10.9 | **Swagger/OpenAPI Export** | Generate OpenAPI spec FROM collection (reverse of current import). | ⬜ Candidate |
| 10.10 | **Bulk Import from Browser DevTools** | Import HAR files captured from Chrome/Firefox DevTools. | ⬜ Candidate |

---

## 11. AUTOMATION & CI/CD — "Pipeline-Ready"

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 11.1 | **Pre-Request Hooks (Global)** | Global scripts that run before EVERY request (add auth token, log timestamp). | ⬜ Candidate |
| 11.2 | **Post-Request Hooks (Global)** | Global scripts that run after every response (log, validate, transform). | ⬜ Candidate |
| 11.3 | **Request Chaining with Variable Passing** | Explicitly define "Request B depends on Request A's response.token field." Visual DAG editor. | ⬜ Candidate |
| 11.4 | **Conditional Request Execution** | Skip request if a condition is met (e.g., "only run if env is production"). | ⬜ Candidate |
| 11.5 | **Scheduled Collection Runs** | Built-in scheduler: "Run smoke tests every day at 8am." | ⬜ Candidate |
| 11.6 | **CI/CD Output Formats** | JUnit XML, TAP, JSON report output for pipeline integration. | ⬜ Candidate |
| 11.7 | **Environment File Watcher** | Auto-reload environment files when changed externally (useful for CI injection). | ⬜ Candidate |
| 11.8 | **Request Capture / Proxy Record Mode** | Act as HTTP proxy, capture traffic, auto-generate requests. Like Charles/Fiddler but built-in. | ⬜ Candidate |

---

## 12. UI/UX ENHANCEMENTS — "Polish & Delight"

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 12.1 | **Minimap / Request Overview** | Large JSON body? Show a minimap like VS Code for quick navigation. | ⬜ Candidate |
| 12.2 | **Multi-Pane Layout** | Open multiple requests side-by-side (not just tabs). | ⬜ Candidate |
| 12.3 | **Zen Mode / Focus Mode** | Hide everything except the current request for distraction-free work. | ⬜ Candidate |
| 12.4 | **Response Body Folding** | Collapse JSON sections in response viewer. | ⬜ Candidate |
| 12.5 | **Breadcrumb Navigation** | Show Collection > Folder > Request path at top for deep nesting. | ⬜ Candidate |
| 12.6 | **Request Timeline Visualization** | Show DNS lookup + TCP connect + TLS handshake + TTFB + download timeline (like Chrome DevTools). | ⬜ Candidate |
| 12.7 | **Floating Quick-Send Widget** | Small persistent widget to fire quick requests without opening full UI. | ⬜ Candidate |
| 12.8 | **System Tray Integration** | Minimize to tray, monitors keep running. Quick-launch from tray menu. | ⬜ Candidate |
| 12.9 | **Multiple Windows** | Open separate windows for different collections/workspaces. | ⬜ Candidate |
| 12.10 | **Table View for Collection Runner Results** | Sortable, filterable table with status codes, times, pass/fail. Export to CSV. | ⬜ Candidate |
| 12.11 | **Drag Requests from History to Collection** | Quickly save history items into organized collections. | ⬜ Candidate |
| 12.12 | **Status Bar with Workspace/Env Info** | Always-visible status bar showing active workspace, environment, proxy status. | ⬜ Candidate |
| 12.13 | **Customizable Toolbar** | Let users pin frequent actions (send, save, generate code) to a toolbar. | ⬜ Candidate |

---

## TOP 15 GAME-CHANGER PICKS (PRM Prioritization)

> Highest-impact items that would differentiate Fetchy in the market.

| Priority | Ref | Feature | Strategic Rationale | Status |
|----------|-----|---------|---------------------|--------|
| **1** | 3.1 | **AI Chat Mode (Multi-Turn)** | No competitor has this. AI-native API client is your moat. | ⬜ Candidate |
| **2** | 7.1 | **CLI Tool (fetchy-cli)** | Unlocks CI/CD market. Without this, Fetchy stays a manual tool. | ⬜ Candidate |
| **3** | 4.1 | **Git-Based Collection Sync** | Team collaboration without cloud. Perfect fit for privacy-first positioning. | ⬜ Candidate |
| **4** | 2.1 | **Test Assertions UI** | Test-driven API development. Can't compete without structured test results. | ⬜ Candidate |
| **5** | 5.1 | **OAuth 2.0 Flow Wizard** | Auth is the #1 friction point in API testing. Every enterprise needs this. | ⬜ Candidate |
| **6** | 3.2 | **AI-Powered Test Generation** | Unique differentiator: "AI writes your API tests." Marketing gold. | ⬜ Candidate |
| **7** | 8.1 | **Built-in Mock Server** | Unlocks design-first workflow. Frontend devs love this. | ⬜ Candidate |
| **8** | 2.2 | **Data-Driven Testing (CSV/JSON)** | Parameterized testing is table stakes for QA workflows. | ⬜ Candidate |
| **9** | 5.4 | **Dynamic Variables / Faker** | `<<$randomEmail>>` etc. — tiny effort, massive developer happiness. | ⬜ Candidate |
| **10** | 1.1 | **GraphQL Query Builder** | Market expectation. Can't be a "modern API client" without it. | ⬜ Candidate |
| **11** | 5.12 | **Command Palette (Ctrl+K)** | Power user magnet. Tiny effort, huge perceived quality boost. | ⬜ Candidate |
| **12** | 9.1 | **API Monitors (Scheduled Runs)** | Background monitoring without leaving the app. Unique for desktop client. | ⬜ Candidate |
| **13** | 4.2 | **File-Per-Request Storage** | Makes Git sync actually useful. Individual file diffs > monolithic JSON. | ⬜ Candidate |
| **14** | 3.10 | **AI Security Scanner** | "AI audits your API security." Unique, high-value, marketing-friendly. | ⬜ Candidate |
| **15** | 11.8 | **Request Capture / Proxy Record Mode** | Replaces Charles/Fiddler for quick capture. Developer workflow shortcut. | ⬜ Candidate |

---

## STRATEGIC POSITIONING NOTE

The sweet spot for Fetchy is: **AI-native + privacy-first + Git-based collaboration**. That's a lane no competitor fully owns.

- **Postman** → cloud-first, expensive, bloated
- **Insomnia** → lost community trust after Kong acquisition
- **Bruno** → Git-based but no AI, limited testing
- **Hoppscotch** → web-first, no desktop depth
- **Thunder Client** → VS Code only, limited features

Fetchy can own the **"intelligent, local-first, developer-native API client"** position.
