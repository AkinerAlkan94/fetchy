import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { yaml } from '@codemirror/lang-yaml';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { usePreferencesStore } from '../store/preferencesStore';
import { useAppStore } from '../store/appStore';
import ResizeHandle from './ResizeHandle';
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Server,
  Tag,
  Lock,
  AlertCircle,
  Copy,
  Check,
  Download,
  FileJson,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  FileInput,
  FileOutput,
  Hash,
  Type,
  List,
  Braces,
  Edit2,
  Save,
} from 'lucide-react';
import * as jsYaml from 'js-yaml';

interface OpenApiEditorProps {
  documentId?: string;
}

interface ParsedOpenAPI {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
    license?: {
      name?: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
  paths?: Record<string, Record<string, PathOperation>>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
}

interface PathOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;
  parameters?: Array<{
    name: string;
    in: string;
    description?: string;
    required?: boolean;
    schema?: Record<string, unknown>;
    example?: unknown;
  }>;
  requestBody?: {
    description?: string;
    required?: boolean;
    content?: Record<string, {
      schema?: Record<string, unknown>;
      example?: unknown;
      examples?: Record<string, { value?: unknown; summary?: string }>;
    }>;
  };
  responses?: Record<string, {
    description?: string;
    headers?: Record<string, {
      description?: string;
      required?: boolean;
      schema?: Record<string, unknown>;
    }>;
    content?: Record<string, {
      schema?: Record<string, unknown>;
      example?: unknown;
      examples?: Record<string, { value?: unknown; summary?: string }>;
    }>;
  }>;
  security?: Array<Record<string, string[]>>;
}

const DEFAULT_OPENAPI_YAML = `openapi: "3.0.3"
info:
  title: Sample API
  description: A sample API to demonstrate OpenAPI editor
  version: "1.0.0"
  contact:
    name: API Support
    email: support@example.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://staging.api.example.com/v1
    description: Staging server

tags:
  - name: users
    description: User management operations
  - name: products
    description: Product operations

paths:
  /users:
    get:
      tags:
        - users
      summary: List all users
      description: Returns a paginated list of users with optional filtering
      operationId: listUsers
      parameters:
        - name: limit
          in: query
          description: Maximum number of users to return
          required: false
          schema:
            type: integer
            default: 10
            minimum: 1
            maximum: 100
        - name: offset
          in: query
          description: Number of users to skip
          required: false
          schema:
            type: integer
            default: 0
        - name: Authorization
          in: header
          description: Bearer token for authentication
          required: true
          schema:
            type: string
          example: "Bearer eyJhbGciOiJIUzI1NiIs..."
        - name: X-Request-ID
          in: header
          description: Unique request identifier for tracing
          required: false
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: A paginated list of users
          headers:
            X-Total-Count:
              description: Total number of users
              schema:
                type: integer
            X-Page-Size:
              description: Number of items per page
              schema:
                type: integer
            X-Request-ID:
              description: Echo of request ID for tracing
              schema:
                type: string
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/User"
                  pagination:
                    $ref: "#/components/schemas/Pagination"
              example:
                data:
                  - id: "550e8400-e29b-41d4-a716-446655440000"
                    name: "John Doe"
                    email: "john@example.com"
                    createdAt: "2024-01-15T10:30:00Z"
                pagination:
                  total: 100
                  limit: 10
                  offset: 0
        "401":
          description: Unauthorized - Invalid or missing token
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example:
                code: "UNAUTHORIZED"
                message: "Invalid or expired token"
    post:
      tags:
        - users
      summary: Create a new user
      description: Creates a new user in the system
      operationId: createUser
      parameters:
        - name: Authorization
          in: header
          description: Bearer token for authentication
          required: true
          schema:
            type: string
        - name: Content-Type
          in: header
          description: Content type of the request body
          required: true
          schema:
            type: string
            enum:
              - application/json
      requestBody:
        description: User data to create
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateUserRequest"
            example:
              name: "Jane Smith"
              email: "jane@example.com"
      responses:
        "201":
          description: User created successfully
          headers:
            Location:
              description: URL of the created user
              schema:
                type: string
                format: uri
            X-Request-ID:
              description: Request ID for tracing
              schema:
                type: string
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
              example:
                id: "550e8400-e29b-41d4-a716-446655440001"
                name: "Jane Smith"
                email: "jane@example.com"
                createdAt: "2024-01-16T14:20:00Z"
        "400":
          description: Invalid request body
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "409":
          description: User with this email already exists
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /users/{userId}:
    get:
      tags:
        - users
      summary: Get user by ID
      description: Returns a single user by their unique identifier
      operationId: getUserById
      parameters:
        - name: userId
          in: path
          description: Unique identifier of the user
          required: true
          schema:
            type: string
            format: uuid
          example: "550e8400-e29b-41d4-a716-446655440000"
        - name: Authorization
          in: header
          description: Bearer token
          required: true
          schema:
            type: string
      responses:
        "200":
          description: User details
          headers:
            Cache-Control:
              description: Cache control directive
              schema:
                type: string
            ETag:
              description: Entity tag for caching
              schema:
                type: string
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "404":
          description: User not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example:
                code: "NOT_FOUND"
                message: "User with the specified ID was not found"
    delete:
      tags:
        - users
      summary: Delete user by ID
      description: Permanently deletes a user from the system
      operationId: deleteUserById
      parameters:
        - name: userId
          in: path
          description: Unique identifier of the user to delete
          required: true
          schema:
            type: string
            format: uuid
          example: "550e8400-e29b-41d4-a716-446655440000"
        - name: Authorization
          in: header
          description: Bearer token for authentication
          required: true
          schema:
            type: string
        - name: X-Confirm-Delete
          in: header
          description: Confirmation header to prevent accidental deletion
          required: true
          schema:
            type: string
            enum:
              - "true"
      responses:
        "204":
          description: User deleted successfully
          headers:
            X-Request-ID:
              description: Request ID for tracing
              schema:
                type: string
            X-Deleted-At:
              description: Timestamp when the user was deleted
              schema:
                type: string
                format: date-time
        "404":
          description: User not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "403":
          description: Forbidden - insufficient permissions
          headers:
            X-Required-Permission:
              description: The permission required to perform this action
              schema:
                type: string

components:
  schemas:
    User:
      type: object
      description: Represents a user in the system
      properties:
        id:
          type: string
          format: uuid
          description: Unique identifier
        name:
          type: string
          description: User's full name
          minLength: 1
          maxLength: 100
        email:
          type: string
          format: email
          description: User's email address
        createdAt:
          type: string
          format: date-time
          description: Timestamp when the user was created
      required:
        - id
        - name
        - email

    CreateUserRequest:
      type: object
      description: Request body for creating a new user
      properties:
        name:
          type: string
          description: User's full name
          minLength: 1
          maxLength: 100
        email:
          type: string
          format: email
          description: User's email address
      required:
        - name
        - email

    Pagination:
      type: object
      description: Pagination metadata
      properties:
        total:
          type: integer
          description: Total number of items
        limit:
          type: integer
          description: Items per page
        offset:
          type: integer
          description: Number of items skipped

    Error:
      type: object
      description: Error response
      properties:
        code:
          type: string
          description: Error code
        message:
          type: string
          description: Human-readable error message
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
      required:
        - code
        - message

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token obtained from /auth/login
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for service-to-service calls

security:
  - bearerAuth: []
`;

const METHOD_COLORS: Record<string, string> = {
  get: 'bg-green-500/20 text-green-400 border-green-500/30',
  post: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  put: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  patch: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  delete: 'bg-red-500/20 text-red-400 border-red-500/30',
  head: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  options: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

// Helper function to resolve $ref references
const resolveRef = (ref: string, spec: ParsedOpenAPI): Record<string, unknown> | null => {
  if (!ref.startsWith('#/')) return null;
  const parts = ref.slice(2).split('/');
  let current: unknown = spec;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return current as Record<string, unknown>;
};

// Helper to generate example JSON from schema
const generateExampleFromSchema = (
  schema: Record<string, unknown>,
  spec: ParsedOpenAPI,
  visited: Set<string> = new Set()
): unknown => {
  // Handle $ref
  if (schema.$ref) {
    const refPath = schema.$ref as string;
    if (visited.has(refPath)) {
      return {}; // Prevent circular reference
    }
    visited.add(refPath);
    const resolved = resolveRef(refPath, spec);
    if (resolved) {
      return generateExampleFromSchema(resolved, spec, visited);
    }
    return {};
  }

  // Use example if provided
  if (schema.example !== undefined) {
    return schema.example;
  }

  const schemaType = schema.type as string;

  switch (schemaType) {
    case 'object': {
      const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
      if (!properties) return {};
      const result: Record<string, unknown> = {};
      for (const [key, propSchema] of Object.entries(properties)) {
        result[key] = generateExampleFromSchema(propSchema, spec, new Set(visited));
      }
      return result;
    }
    case 'array': {
      const items = schema.items as Record<string, unknown> | undefined;
      if (!items) return [];
      return [generateExampleFromSchema(items, spec, new Set(visited))];
    }
    case 'string': {
      const format = schema.format as string | undefined;
      if (format === 'date-time') return '2024-01-15T10:30:00Z';
      if (format === 'date') return '2024-01-15';
      if (format === 'email') return 'user@example.com';
      if (format === 'uuid') return '550e8400-e29b-41d4-a716-446655440000';
      if (format === 'uri') return 'https://example.com';
      if (schema.enum) return (schema.enum as string[])[0];
      return 'string';
    }
    case 'integer':
    case 'number': {
      if (schema.example !== undefined) return schema.example;
      if (schema.default !== undefined) return schema.default;
      if (schema.minimum !== undefined) return schema.minimum;
      return schemaType === 'integer' ? 0 : 0.0;
    }
    case 'boolean':
      return true;
    default:
      return null;
  }
};

// Helper to get schema type display
const getSchemaTypeDisplay = (schema: Record<string, unknown>): string => {
  if (schema.$ref) {
    const refName = (schema.$ref as string).split('/').pop();
    return refName || 'object';
  }
  if (schema.type === 'array' && schema.items) {
    const items = schema.items as Record<string, unknown>;
    if (items.$ref) {
      return `array<${(items.$ref as string).split('/').pop()}>`;
    }
    return `array<${items.type || 'any'}>`;
  }
  return (schema.type as string) || 'any';
};

// Schema viewer component
const SchemaViewer = ({
  schema,
  spec,
  title,
  depth = 0
}: {
  schema: Record<string, unknown>;
  spec: ParsedOpenAPI;
  title?: string;
  depth?: number;
}) => {
  const [expanded, setExpanded] = useState(depth < 2);

  // Resolve $ref if present
  let resolvedSchema = schema;
  let refName: string | null = null;
  if (schema.$ref) {
    refName = (schema.$ref as string).split('/').pop() || null;
    const resolved = resolveRef(schema.$ref as string, spec);
    if (resolved) {
      resolvedSchema = resolved;
    }
  }

  const schemaType = resolvedSchema.type as string;
  const properties = resolvedSchema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (resolvedSchema.required as string[]) || [];
  const items = resolvedSchema.items as Record<string, unknown> | undefined;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'string': return <Type size={12} className="text-green-400" />;
      case 'integer':
      case 'number': return <Hash size={12} className="text-blue-400" />;
      case 'array': return <List size={12} className="text-yellow-400" />;
      case 'object': return <Braces size={12} className="text-purple-400" />;
      case 'boolean': return <span className="text-[10px] text-orange-400">bool</span>;
      default: return null;
    }
  };

  if (schemaType === 'object' && properties) {
    return (
      <div className={`${depth > 0 ? 'ml-4 border-l border-aki-border pl-3' : ''}`}>
        {title ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs text-aki-text-muted hover:text-aki-text mb-1"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className="font-medium">{title}</span>
            {refName ? <span className="text-aki-accent">({refName})</span> : null}
          </button>
        ) : null}
        {expanded ? (
          <div className="space-y-1">
            {Object.entries(properties).map(([propName, propSchema]) => {
              const isRequired = required.includes(propName);
              const propType = getSchemaTypeDisplay(propSchema);
              const hasNestedProps = propSchema.type === 'object' || propSchema.$ref ||
                (propSchema.type === 'array' && propSchema.items);

              return (
                <div key={propName} className="text-xs">
                  <div className="flex items-center gap-2 py-1 px-2 bg-aki-bg/50 rounded">
                    {getTypeIcon(propSchema.type as string || (propSchema.$ref ? 'object' : 'any'))}
                    <span className="font-mono text-aki-text">{propName}</span>
                    <span className="text-aki-text-muted">{propType}</span>
                    {isRequired ? (
                      <span className="px-1 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded">required</span>
                    ) : null}
                    {propSchema.format ? (
                      <span className="text-aki-text-muted">({String(propSchema.format)})</span>
                    ) : null}
                  </div>
                  {propSchema.description ? (
                    <p className="text-aki-text-muted ml-6 mt-0.5">{String(propSchema.description)}</p>
                  ) : null}
                  {hasNestedProps && propSchema.type === 'object' ? (
                    <SchemaViewer schema={propSchema} spec={spec} depth={depth + 1} />
                  ) : null}
                  {hasNestedProps && propSchema.$ref ? (
                    <SchemaViewer schema={propSchema} spec={spec} depth={depth + 1} />
                  ) : null}
                  {propSchema.type === 'array' && propSchema.items ? (
                    <div className="ml-4 mt-1">
                      <span className="text-[10px] text-aki-text-muted">items:</span>
                      <SchemaViewer schema={propSchema.items as Record<string, unknown>} spec={spec} depth={depth + 1} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  if (schemaType === 'array' && items) {
    return (
      <div className={`${depth > 0 ? 'ml-4 border-l border-aki-border pl-3' : ''}`}>
        {title && (
          <div className="flex items-center gap-2 text-xs text-aki-text-muted mb-1">
            <List size={12} className="text-yellow-400" />
            <span className="font-medium">{title}</span>
            <span className="text-aki-accent">array</span>
          </div>
        )}
        <div className="text-xs text-aki-text-muted ml-2">
          <span>items: </span>
          {items.$ref ? (
            <SchemaViewer schema={items} spec={spec} depth={depth + 1} />
          ) : (
            <span className="text-aki-text">{getSchemaTypeDisplay(items)}</span>
          )}
        </div>
      </div>
    );
  }

  // Simple type
  return (
    <div className="flex items-center gap-2 text-xs py-1">
      {getTypeIcon(schemaType)}
      {title ? <span className="font-medium text-aki-text-muted">{title}:</span> : null}
      <span className="text-aki-text">{schemaType || 'any'}</span>
      {resolvedSchema.format ? <span className="text-aki-text-muted">({String(resolvedSchema.format)})</span> : null}
      {refName ? <span className="text-aki-accent">({refName})</span> : null}
    </div>
  );
};

export default function OpenApiEditor({ documentId }: OpenApiEditorProps) {
  const { preferences } = usePreferencesStore();
  const { updateOpenApiDocument, getOpenApiDocument, updateTab, tabs } = useAppStore();
  const isDark = preferences.theme === 'dark';

  const [content, setContent] = useState(DEFAULT_OPENAPI_YAML);
  const [savedContent, setSavedContent] = useState(DEFAULT_OPENAPI_YAML);
  const [format, setFormat] = useState<'yaml' | 'json'>('yaml');
  const [savedFormat, setSavedFormat] = useState<'yaml' | 'json'>('yaml');
  const [parsedSpec, setParsedSpec] = useState<ParsedOpenAPI | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [editorWidth, setEditorWidth] = useState(50);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set(['users', 'products']));
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'info' | 'paths' | 'schemas'>('paths');
  const [documentName, setDocumentName] = useState('New API Spec');
  const [isEditingName, setIsEditingName] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Check if document has unsaved changes
  const isModified = content !== savedContent || format !== savedFormat;

  // Update tab's isModified state when it changes
  useEffect(() => {
    if (documentId) {
      const tab = tabs.find(t => t.openApiDocId === documentId);
      if (tab && tab.isModified !== isModified) {
        updateTab(tab.id, { isModified });
      }
    }
  }, [isModified, documentId, tabs, updateTab]);

  // Load document if documentId is provided
  useEffect(() => {
    if (documentId) {
      const doc = getOpenApiDocument(documentId);
      if (doc) {
        // Document exists, load its content
        const docContent = doc.content || DEFAULT_OPENAPI_YAML;
        const docFormat = doc.format || 'yaml';
        setContent(docContent);
        setSavedContent(docContent);
        setFormat(docFormat);
        setSavedFormat(docFormat);
        setDocumentName(doc.name || 'New API Spec');
      }
    }
  }, [documentId, getOpenApiDocument]);

  // Parse the OpenAPI content (without auto-saving)
  useEffect(() => {
    try {
      let parsed: ParsedOpenAPI;
      if (format === 'yaml') {
        parsed = jsYaml.load(content) as ParsedOpenAPI;
      } else {
        parsed = JSON.parse(content);
      }
      setParsedSpec(parsed);
      setParseError(null);
    } catch (e) {
      setParseError((e as Error).message);
      setParsedSpec(null);
    }
  }, [content, format]);

  // Save document manually
  const saveDocument = useCallback(() => {
    if (documentId) {
      updateOpenApiDocument(documentId, { content, format });
      setSavedContent(content);
      setSavedFormat(format);
    }
  }, [documentId, content, format, updateOpenApiDocument]);

  // Handle Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDocument();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveDocument]);

  // Handle document name change
  const handleNameChange = useCallback((newName: string) => {
    if (documentId && newName.trim()) {
      setDocumentName(newName.trim());
      updateOpenApiDocument(documentId, { name: newName.trim() });
      // Update all tabs with this openApiDocId to reflect the new name
      tabs.forEach(tab => {
        if (tab.openApiDocId === documentId) {
          updateTab(tab.id, { title: newName.trim() });
        }
      });
    }
    setIsEditingName(false);
  }, [documentId, updateOpenApiDocument, tabs, updateTab]);

  // Focus name input when editing
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      basicSetup,
      EditorView.lineWrapping,
      ...(isDark ? [oneDark] : []),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { minHeight: '100%' },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          setContent(update.state.doc.toString());
        }
      }),
    ];

    if (format === 'yaml') {
      extensions.push(yaml());
    } else {
      extensions.push(json());
    }

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [format, isDark]);

  // Update editor content when it changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== content) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: content,
          },
        });
      }
    }
  }, [content]);

  const handleEditorResize = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const pixelWidth = (editorWidth / 100) * containerWidth;
    const newPixelWidth = Math.max(200, Math.min(containerWidth - 200, pixelWidth + delta));
    const newPercentage = (newPixelWidth / containerWidth) * 100;
    setEditorWidth(newPercentage);
  }, [editorWidth]);

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setExpandedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const copyEndpoint = (method: string, path: string) => {
    const server = parsedSpec?.servers?.[0]?.url || '';
    const fullUrl = `${server}${path}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedEndpoint(`${method}:${path}`);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  // Helper to merge path-level and operation-level parameters
  const getMergedParameters = (
    pathItem: Record<string, unknown>,
    operation: PathOperation
  ): Array<{
    name: string;
    in: string;
    description?: string;
    required?: boolean;
    schema?: Record<string, unknown>;
    example?: unknown;
  }> => {
    const pathParams = (pathItem.parameters as Array<Record<string, unknown>> | undefined) || [];
    const opParams = (operation.parameters as Array<Record<string, unknown>> | undefined) || [];

    // Convert path-level $ref parameters to resolved parameters
    const resolvedPathParams = pathParams.map(param => {
      if (param.$ref) {
        // For now, we'll assume the parameter structure is inline in the path
        // In a full implementation, you'd resolve the $ref here
        return param as any;
      }
      return param as any;
    });

    // Merge path and operation parameters, with operation parameters taking precedence
    const paramMap = new Map<string, any>();

    // Add path-level parameters first
    resolvedPathParams.forEach(param => {
      if (param.name && param.in) {
        paramMap.set(`${param.name}:${param.in}`, param);
      }
    });

    // Add/override with operation-level parameters
    opParams.forEach(param => {
      if (param.name && param.in) {
        paramMap.set(`${param.name}:${param.in}`, param);
      }
    });

    return Array.from(paramMap.values());
  };

  const convertFormat = () => {
    try {
      if (format === 'yaml') {
        const parsed = jsYaml.load(content);
        setContent(JSON.stringify(parsed, null, 2));
        setFormat('json');
      } else {
        const parsed = JSON.parse(content);
        setContent(jsYaml.dump(parsed, { indent: 2, lineWidth: -1 }));
        setFormat('yaml');
      }
    } catch (e) {
      // Keep the current format if conversion fails
    }
  };

  const downloadSpec = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openapi.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Group paths by tags
  const pathsByTag = useMemo(() => {
    if (!parsedSpec?.paths) return new Map<string, Array<{ path: string; method: string; operation: PathOperation; pathItem: Record<string, unknown> }>>();

    const grouped = new Map<string, Array<{ path: string; method: string; operation: PathOperation; pathItem: Record<string, unknown> }>>();

    for (const [path, methods] of Object.entries(parsedSpec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (typeof operation !== 'object' || !operation) continue;
        const op = operation as PathOperation;

        // If operation has tags, use them; otherwise it goes to 'Untagged'
        if (op.tags && op.tags.length > 0) {
          for (const tag of op.tags) {
            if (!grouped.has(tag)) {
              grouped.set(tag, []);
            }
            grouped.get(tag)!.push({ path, method, operation: op, pathItem: methods as Record<string, unknown> });
          }
        } else {
          // No tags defined, put in Untagged
          if (!grouped.has('Untagged')) {
            grouped.set('Untagged', []);
          }
          grouped.get('Untagged')!.push({ path, method, operation: op, pathItem: methods as Record<string, unknown> });
        }
      }
    }

    return grouped;
  }, [parsedSpec]);

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden bg-aki-bg">
      {/* Toolbar */}
      <div className="h-12 bg-aki-sidebar border-b border-aki-border flex items-center px-4 gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <FileCode size={18} className="text-aki-accent" />
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              defaultValue={documentName}
              className="font-medium text-aki-text bg-aki-bg border border-aki-accent rounded px-2 py-0.5 text-sm outline-none w-48"
              onBlur={(e) => handleNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNameChange(e.currentTarget.value);
                } else if (e.key === 'Escape') {
                  setIsEditingName(false);
                }
              }}
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="font-medium text-aki-text hover:text-aki-accent flex items-center gap-1 group"
              title="Click to rename"
            >
              {documentName}
              <Edit2 size={12} className="text-aki-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* Save button */}
          <button
            onClick={saveDocument}
            disabled={!isModified}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors ${
              isModified
                ? 'bg-aki-accent text-white hover:bg-aki-accent/90'
                : 'bg-aki-bg border border-aki-border text-aki-text-muted cursor-not-allowed'
            }`}
            title="Save (Ctrl+S)"
          >
            <Save size={14} />
            Save
          </button>
          <button
            onClick={convertFormat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-aki-bg border border-aki-border rounded hover:bg-aki-border transition-colors"
            title={`Convert to ${format === 'yaml' ? 'JSON' : 'YAML'}`}
          >
            {format === 'yaml' ? <FileJson size={14} /> : <FileText size={14} />}
            {format === 'yaml' ? 'To JSON' : 'To YAML'}
          </button>
          <button
            onClick={downloadSpec}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-aki-bg border border-aki-border rounded hover:bg-aki-border transition-colors"
          >
            <Download size={14} />
            Download
          </button>
        </div>

        {/* Unsaved indicator */}
        {isModified ? (
          <div className="flex items-center gap-1.5 text-xs text-yellow-400">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span>Unsaved changes</span>
          </div>
        ) : null}

        <div className="flex-1" />

        {parsedSpec ? (
          <div className="flex items-center gap-3 text-sm text-aki-text-muted">
            <span className="px-2 py-0.5 bg-aki-accent/20 text-aki-accent rounded text-xs font-medium">
              {parsedSpec.openapi || parsedSpec.swagger || 'Unknown'}
            </span>
            <span>{parsedSpec.info?.title || 'Untitled API'}</span>
            <span className="text-aki-text-muted">v{parsedSpec.info?.version || '0.0.0'}</span>
          </div>
        ) : null}
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div style={{ width: `${editorWidth}%` }} className="h-full flex flex-col shrink-0 overflow-hidden">
          <div className="h-8 bg-aki-sidebar border-b border-aki-border flex items-center px-3 gap-2">
            <span className={`text-xs px-2 py-0.5 rounded ${format === 'yaml' ? 'bg-purple-500/20 text-purple-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {format.toUpperCase()}
            </span>
            <span className="text-xs text-aki-text-muted">Source</span>
          </div>
          <div ref={editorRef} className="flex-1 overflow-auto" />
        </div>

        {/* Resize Handle */}
        <ResizeHandle direction="horizontal" onResize={handleEditorResize} />

        {/* Visualization Panel */}
        <div className="flex-1 h-full flex flex-col overflow-hidden">
          <div className="h-8 bg-aki-sidebar border-b border-aki-border flex items-center px-3">
            <span className="text-xs text-aki-text-muted">Preview</span>
          </div>

          {parseError ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-md text-center">
                <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
                <h3 className="text-lg font-medium text-aki-text mb-2">Parse Error</h3>
                <p className="text-sm text-aki-text-muted font-mono bg-aki-sidebar p-3 rounded">
                  {parseError}
                </p>
              </div>
            </div>
          ) : parsedSpec ? (
            <div className="flex-1 overflow-auto">
              {/* API Info Section */}
              <div className="p-4 border-b border-aki-border">
                <h2 className="text-xl font-bold text-aki-text mb-1">{parsedSpec.info?.title || 'Untitled API'}</h2>
                {parsedSpec.info?.description && (
                  <p className="text-sm text-aki-text-muted mb-3">{parsedSpec.info.description}</p>
                )}

                {/* Servers */}
                {parsedSpec.servers && parsedSpec.servers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {parsedSpec.servers.map((server, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-aki-sidebar rounded text-xs">
                        <Server size={12} className="text-aki-accent" />
                        <span className="text-aki-text">{server.url}</span>
                        {server.description && (
                          <span className="text-aki-text-muted">({server.description})</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Section tabs */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setActiveSection('paths')}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${activeSection === 'paths' ? 'bg-aki-accent text-white' : 'bg-aki-sidebar text-aki-text hover:bg-aki-border'}`}
                  >
                    Paths
                  </button>
                  <button
                    onClick={() => setActiveSection('schemas')}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${activeSection === 'schemas' ? 'bg-aki-accent text-white' : 'bg-aki-sidebar text-aki-text hover:bg-aki-border'}`}
                  >
                    Schemas
                  </button>
                  <button
                    onClick={() => setActiveSection('info')}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${activeSection === 'info' ? 'bg-aki-accent text-white' : 'bg-aki-sidebar text-aki-text hover:bg-aki-border'}`}
                  >
                    Info
                  </button>
                </div>
              </div>

              {/* Paths Section */}
              {activeSection === 'paths' && (
                <div className="p-4">
                  {Array.from(pathsByTag.entries()).map(([tag, operations]) => (
                    <div key={tag} className="mb-4">
                      {/* Tag Header */}
                      <button
                        onClick={() => toggleTag(tag)}
                        className="w-full flex items-center gap-2 p-2 rounded hover:bg-aki-sidebar transition-colors"
                      >
                        {expandedTags.has(tag) ? (
                          <ChevronDown size={16} className="text-aki-text-muted" />
                        ) : (
                          <ChevronRight size={16} className="text-aki-text-muted" />
                        )}
                        <Tag size={14} className="text-aki-accent" />
                        <span className="font-medium text-aki-text">{tag}</span>
                        <span className="text-xs text-aki-text-muted">({operations.length})</span>
                      </button>

                      {/* Operations */}
                      {expandedTags.has(tag) && (
                        <div className="ml-6 space-y-2">
                          {operations.map(({ path, method, operation, pathItem }) => {
                            const pathKey = `${method}:${path}`;
                            const isExpanded = expandedPaths.has(pathKey);
                            const mergedParameters = getMergedParameters(pathItem, operation);

                            return (
                              <div key={pathKey} className="border border-aki-border rounded overflow-hidden">
                                {/* Operation Header */}
                                <button
                                  onClick={() => togglePath(pathKey)}
                                  className="w-full flex items-center gap-3 p-3 hover:bg-aki-sidebar/50 transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDown size={14} className="text-aki-text-muted shrink-0" />
                                  ) : (
                                    <ChevronRight size={14} className="text-aki-text-muted shrink-0" />
                                  )}
                                  <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded border ${METHOD_COLORS[method] || METHOD_COLORS.get}`}>
                                    {method}
                                  </span>
                                  <span className="font-mono text-sm text-aki-text flex-1 text-left">{path}</span>
                                  {operation.deprecated && (
                                    <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                                      Deprecated
                                    </span>
                                  )}
                                  {operation.summary && (
                                    <span className="text-sm text-aki-text-muted truncate max-w-[200px]">
                                      {operation.summary}
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyEndpoint(method, path);
                                    }}
                                    className="p-1 hover:bg-aki-border rounded"
                                    title="Copy endpoint URL"
                                  >
                                    {copiedEndpoint === pathKey ? (
                                      <Check size={14} className="text-green-400" />
                                    ) : (
                                      <Copy size={14} className="text-aki-text-muted" />
                                    )}
                                  </button>
                                </button>

                                {/* Operation Details */}
                                {isExpanded && (
                                  <div className="border-t border-aki-border bg-aki-sidebar/30">
                                    {/* Description */}
                                    {operation.description && (
                                      <div className="p-4 border-b border-aki-border">
                                        <p className="text-sm text-aki-text">{operation.description}</p>
                                      </div>
                                    )}

                                    <div className="grid grid-cols-2 divide-x divide-aki-border">
                                      {/* REQUEST SIDE */}
                                      <div className="p-4">
                                        <div className="flex items-center gap-2 mb-4">
                                          <ArrowUpRight size={16} className="text-blue-400" />
                                          <h4 className="text-sm font-semibold text-aki-text">Request</h4>
                                        </div>

                                        {/* Path Parameters */}
                                        {(() => {
                                          const pathParams = mergedParameters?.filter(p => p.in === 'path') || [];
                                          return pathParams.length > 0 ? (
                                            <div className="mb-4">
                                              <h5 className="text-xs font-medium text-aki-text-muted uppercase mb-2 flex items-center gap-1">
                                                <FileInput size={12} />
                                                Path Parameters
                                              </h5>
                                              <div className="space-y-1">
                                                {pathParams.map((param, idx) => (
                                                  <div key={idx} className="p-2 bg-aki-bg rounded text-xs">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <span className="font-mono font-medium text-aki-accent">{param.name}</span>
                                                      {param.schema && (
                                                        <span className="text-aki-text-muted">{getSchemaTypeDisplay(param.schema)}</span>
                                                      )}
                                                      <span className="px-1 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">required</span>
                                                    </div>
                                                    {param.description && (
                                                      <p className="text-aki-text-muted mt-1">{param.description}</p>
                                                    )}
                                                    {param.example !== undefined && (
                                                      <p className="text-aki-text mt-1">Example: <code className="bg-aki-sidebar px-1 rounded">{String(param.example)}</code></p>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ) : null;
                                        })()}

                                        {/* Query Parameters */}
                                        {(() => {
                                          const queryParams = mergedParameters?.filter(p => p.in === 'query') || [];
                                          return queryParams.length > 0 ? (
                                            <div className="mb-4">
                                              <h5 className="text-xs font-medium text-aki-text-muted uppercase mb-2 flex items-center gap-1">
                                                <FileInput size={12} />
                                                Query Parameters
                                              </h5>
                                              <div className="space-y-1">
                                                {queryParams.map((param, idx) => (
                                                  <div key={idx} className="p-2 bg-aki-bg rounded text-xs">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <span className="font-mono font-medium text-aki-accent">{param.name}</span>
                                                      {param.schema && (
                                                        <span className="text-aki-text-muted">{getSchemaTypeDisplay(param.schema)}</span>
                                                      )}
                                                      {param.required && (
                                                        <span className="px-1 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">required</span>
                                                      )}
                                                    </div>
                                                    {param.description && (
                                                      <p className="text-aki-text-muted mt-1">{param.description}</p>
                                                    )}
                                                    {param.schema?.default !== undefined && (
                                                      <p className="text-aki-text mt-1">Default: <code className="bg-aki-sidebar px-1 rounded">{String(param.schema.default)}</code></p>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ) : null;
                                        })()}

                                        {/* Request Headers - Always show */}
                                        {(() => {
                                          const headerParams = mergedParameters?.filter(p => p.in === 'header') || [];
                                          return (
                                            <div className="mb-4">
                                              <h5 className="text-xs font-medium text-aki-text-muted uppercase mb-2 flex items-center gap-1">
                                                <FileInput size={12} />
                                                Request Headers
                                                {headerParams.length > 0 && (
                                                  <span className="text-[10px] text-aki-accent ml-1">
                                                    ({headerParams.length})
                                                  </span>
                                                )}
                                              </h5>
                                              {headerParams.length > 0 ? (
                                                <div className="bg-aki-bg rounded overflow-hidden">
                                                  <table className="w-full text-xs">
                                                    <thead>
                                                      <tr className="border-b border-aki-border bg-aki-sidebar/50">
                                                        <th className="text-left p-2 font-medium text-aki-text-muted">Header</th>
                                                        <th className="text-left p-2 font-medium text-aki-text-muted">Type</th>
                                                        <th className="text-left p-2 font-medium text-aki-text-muted">Required</th>
                                                        <th className="text-left p-2 font-medium text-aki-text-muted">Description</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {headerParams.map((param, idx) => (
                                                        <tr key={idx} className="border-b border-aki-border/50 last:border-0">
                                                          <td className="p-2">
                                                            <span className="font-mono font-medium text-aki-accent">{param.name}</span>
                                                          </td>
                                                          <td className="p-2 text-aki-text-muted">
                                                            {param.schema ? getSchemaTypeDisplay(param.schema) : 'string'}
                                                            {param.schema?.format ? (
                                                              <div className="text-[10px] text-aki-text-muted mt-0.5">
                                                                format: {String(param.schema.format)}
                                                              </div>
                                                            ) : null}
                                                            {param.schema?.enum ? (
                                                              <div className="text-[10px] text-aki-text-muted mt-0.5">
                                                                enum: [{(param.schema.enum as string[]).join(', ')}]
                                                              </div>
                                                            ) : null}
                                                          </td>
                                                          <td className="p-2">
                                                            {param.required ? (
                                                              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">Yes</span>
                                                            ) : (
                                                              <span className="text-aki-text-muted">No</span>
                                                            )}
                                                          </td>
                                                          <td className="p-2 text-aki-text-muted">
                                                            {param.description || '-'}
                                                            {param.example !== undefined ? (
                                                              <div className="mt-1">
                                                                <span className="text-[10px]">Example: </span>
                                                                <code className="bg-aki-sidebar px-1 rounded text-aki-text">{String(param.example)}</code>
                                                              </div>
                                                            ) : null}
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              ) : (
                                                <p className="text-xs text-aki-text-muted italic bg-aki-bg p-2 rounded">No request headers defined</p>
                                              )}
                                            </div>
                                          );
                                        })()}

                                        {/* Request Body */}
                                        {operation.requestBody && (
                                          <div className="mb-4">
                                            <h5 className="text-xs font-medium text-aki-text-muted uppercase mb-2 flex items-center gap-1">
                                              <FileInput size={12} />
                                              Request Body
                                              {operation.requestBody.required ? (
                                                <span className="px-1 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] ml-1">required</span>
                                              ) : null}
                                            </h5>
                                            {operation.requestBody.description ? (
                                              <p className="text-xs text-aki-text-muted mb-2">{operation.requestBody.description}</p>
                                            ) : null}
                                            {operation.requestBody.content ? Object.entries(operation.requestBody.content).map(([contentType, content]) => {
                                              // Generate example JSON from schema if no explicit example
                                              const exampleJson = content.example ||
                                                (content.schema ? generateExampleFromSchema(content.schema, parsedSpec!) : null);

                                              return (
                                                <div key={contentType} className="bg-aki-bg rounded overflow-hidden mb-2">
                                                  <div className="px-2 py-1 bg-aki-sidebar/50 border-b border-aki-border flex items-center justify-between">
                                                    <span className="text-xs font-mono text-aki-accent">{contentType}</span>
                                                    {exampleJson ? (
                                                      <button
                                                        onClick={() => navigator.clipboard.writeText(JSON.stringify(exampleJson, null, 2))}
                                                        className="p-1 hover:bg-aki-border rounded text-aki-text-muted hover:text-aki-text"
                                                        title="Copy JSON"
                                                      >
                                                        <Copy size={12} />
                                                      </button>
                                                    ) : null}
                                                  </div>
                                                  <div className="p-2">
                                                    {/* Show JSON Example First */}
                                                    {exampleJson ? (
                                                      <div className="mb-3">
                                                        <span className="text-[10px] text-aki-text-muted uppercase font-medium">Example JSON:</span>
                                                        <pre className="text-xs bg-aki-sidebar text-green-400 p-3 rounded mt-1 overflow-auto max-h-60 font-mono">
                                                          {JSON.stringify(exampleJson, null, 2)}
                                                        </pre>
                                                      </div>
                                                    ) : null}
                                                    {/* Schema Details (collapsible) */}
                                                    {content.schema ? (
                                                      <details className="mt-2">
                                                        <summary className="text-[10px] text-aki-text-muted uppercase cursor-pointer hover:text-aki-text">
                                                          Schema Details
                                                        </summary>
                                                        <div className="mt-2 pl-2 border-l-2 border-aki-border">
                                                          <SchemaViewer schema={content.schema} spec={parsedSpec!} />
                                                        </div>
                                                      </details>
                                                    ) : null}
                                                  </div>
                                                </div>
                                              );
                                            }) : null}
                                          </div>
                                        )}

                                        {/* Security */}
                                        {operation.security && operation.security.length > 0 && (
                                          <div>
                                            <h5 className="text-xs font-medium text-aki-text-muted uppercase mb-2 flex items-center gap-1">
                                              <Lock size={12} />
                                              Security
                                            </h5>
                                            <div className="flex flex-wrap gap-1">
                                              {operation.security.map((sec, idx) => (
                                                Object.entries(sec).map(([key, scopes]) => (
                                                  <div key={`${idx}-${key}`} className="px-2 py-1 bg-aki-bg rounded text-xs">
                                                    <span className="font-medium text-aki-accent">{key}</span>
                                                    {scopes && scopes.length > 0 && (
                                                      <span className="text-aki-text-muted ml-1">({scopes.join(', ')})</span>
                                                    )}
                                                  </div>
                                                ))
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* No request body message */}
                                        {!operation.requestBody && (
                                          <p className="text-xs text-aki-text-muted italic bg-aki-bg p-2 rounded">No request body</p>
                                        )}
                                      </div>

                                      {/* RESPONSE SIDE */}
                                      <div className="p-4">
                                        <div className="flex items-center gap-2 mb-4">
                                          <ArrowDownLeft size={16} className="text-green-400" />
                                          <h4 className="text-sm font-semibold text-aki-text">Responses</h4>
                                        </div>

                                        {operation.responses && Object.entries(operation.responses).map(([code, response]) => (
                                          <div key={code} className="mb-4 last:mb-0">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                                                code.startsWith('2') ? 'bg-green-500/20 text-green-400' :
                                                code.startsWith('3') ? 'bg-blue-500/20 text-blue-400' :
                                                code.startsWith('4') ? 'bg-yellow-500/20 text-yellow-400' :
                                                code.startsWith('5') ? 'bg-red-500/20 text-red-400' :
                                                'bg-aki-sidebar text-aki-text-muted'
                                              }`}>
                                                {code}
                                              </span>
                                              <span className="text-xs text-aki-text">{response.description}</span>
                                            </div>

                                            {/* Response Headers - Always show */}
                                            {(() => {
                                              const responseHeaders = response.headers ? Object.entries(response.headers) : [];
                                              return (
                                                <div className="mb-2 ml-2">
                                                  <h6 className="text-[10px] font-medium text-aki-text-muted uppercase mb-1 flex items-center gap-1">
                                                    <FileOutput size={10} />
                                                    Response Headers
                                                    {responseHeaders.length > 0 && (
                                                      <span className="text-[10px] text-aki-accent ml-1">
                                                        ({responseHeaders.length})
                                                      </span>
                                                    )}
                                                  </h6>
                                                  {responseHeaders.length > 0 ? (
                                                    <div className="bg-aki-bg rounded overflow-hidden">
                                                      <table className="w-full text-xs">
                                                        <thead>
                                                          <tr className="border-b border-aki-border bg-aki-sidebar/50">
                                                            <th className="text-left p-1.5 font-medium text-aki-text-muted">Header</th>
                                                            <th className="text-left p-1.5 font-medium text-aki-text-muted">Type</th>
                                                            <th className="text-left p-1.5 font-medium text-aki-text-muted">Description</th>
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {responseHeaders.map(([headerName, headerDef]) => (
                                                            <tr key={headerName} className="border-b border-aki-border/50 last:border-0">
                                                              <td className="p-1.5">
                                                                <span className="font-mono font-medium text-aki-accent">{headerName}</span>
                                                              </td>
                                                              <td className="p-1.5 text-aki-text-muted">
                                                                {headerDef.schema ? getSchemaTypeDisplay(headerDef.schema) : 'string'}
                                                                {headerDef.schema?.format ? (
                                                                  <div className="text-[10px] mt-0.5">format: {String(headerDef.schema.format)}</div>
                                                                ) : null}
                                                              </td>
                                                              <td className="p-1.5 text-aki-text-muted">
                                                                {headerDef.description || '-'}
                                                              </td>
                                                            </tr>
                                                          ))}
                                                        </tbody>
                                                      </table>
                                                    </div>
                                                  ) : (
                                                    <p className="text-[10px] text-aki-text-muted italic bg-aki-bg p-1.5 rounded">No response headers defined</p>
                                                  )}
                                                </div>
                                              );
                                            })()}

                                            {/* Response Body */}
                                            {response.content ? Object.entries(response.content).map(([contentType, content]) => {
                                              // Generate example JSON from schema if no explicit example
                                              const exampleJson = content.example ||
                                                (content.examples ? Object.values(content.examples)[0]?.value : null) ||
                                                (content.schema ? generateExampleFromSchema(content.schema, parsedSpec!) : null);

                                              return (
                                                <div key={contentType} className="bg-aki-bg rounded overflow-hidden ml-2 mb-2">
                                                  <div className="px-2 py-1 bg-aki-sidebar/50 border-b border-aki-border flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                      <FileOutput size={10} className="text-aki-text-muted" />
                                                      <span className="text-xs font-mono text-aki-accent">{contentType}</span>
                                                    </div>
                                                    {exampleJson ? (
                                                      <button
                                                        onClick={() => navigator.clipboard.writeText(JSON.stringify(exampleJson, null, 2))}
                                                        className="p-1 hover:bg-aki-border rounded text-aki-text-muted hover:text-aki-text"
                                                        title="Copy JSON"
                                                      >
                                                        <Copy size={12} />
                                                      </button>
                                                    ) : null}
                                                  </div>
                                                  <div className="p-2">
                                                    {/* Show JSON Example First */}
                                                    {exampleJson ? (
                                                      <div className="mb-3">
                                                        <span className="text-[10px] text-aki-text-muted uppercase font-medium">Example JSON:</span>
                                                        <pre className="text-xs bg-aki-sidebar text-green-400 p-3 rounded mt-1 overflow-auto max-h-60 font-mono">
                                                          {JSON.stringify(exampleJson, null, 2)}
                                                        </pre>
                                                      </div>
                                                    ) : null}
                                                    {/* Multiple examples if available */}
                                                    {content.examples && Object.keys(content.examples).length > 1 ? (
                                                      <details className="mb-2">
                                                        <summary className="text-[10px] text-aki-text-muted uppercase cursor-pointer hover:text-aki-text">
                                                          More Examples ({Object.keys(content.examples).length})
                                                        </summary>
                                                        <div className="mt-2 space-y-2">
                                                          {Object.entries(content.examples).slice(1).map(([exName, ex]) => (
                                                            <div key={exName}>
                                                              <span className="text-[10px] text-aki-text-muted">
                                                                {ex.summary || exName}:
                                                              </span>
                                                              <pre className="text-xs bg-aki-sidebar text-green-400 p-2 rounded mt-1 overflow-auto max-h-40 font-mono">
                                                                {JSON.stringify(ex.value, null, 2)}
                                                              </pre>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      </details>
                                                    ) : null}
                                                    {/* Schema Details (collapsible) */}
                                                    {content.schema ? (
                                                      <details>
                                                        <summary className="text-[10px] text-aki-text-muted uppercase cursor-pointer hover:text-aki-text">
                                                          Schema Details
                                                        </summary>
                                                        <div className="mt-2 pl-2 border-l-2 border-aki-border">
                                                          <SchemaViewer schema={content.schema} spec={parsedSpec!} />
                                                        </div>
                                                      </details>
                                                    ) : null}
                                                  </div>
                                                </div>
                                              );
                                            }) : null}

                                            {/* No response body message */}
                                            {!response.content ? (
                                              <p className="text-[10px] text-aki-text-muted italic ml-2 bg-aki-bg p-1.5 rounded">No response body</p>
                                            ) : null}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Schemas Section */}
              {activeSection === 'schemas' && parsedSpec.components?.schemas ? (
                <div className="p-4">
                  <div className="space-y-3">
                    {Object.entries(parsedSpec.components.schemas).map(([name, schema]) => {
                      const schemaObj = schema as Record<string, unknown>;
                      const exampleJson = generateExampleFromSchema(schemaObj, parsedSpec);

                      return (
                        <div key={name} className="border border-aki-border rounded overflow-hidden">
                          <div className="flex items-center justify-between p-3 bg-aki-sidebar/50">
                            <div className="flex items-center gap-2">
                              <Braces size={14} className="text-purple-400" />
                              <span className="font-mono font-medium text-aki-text">{name}</span>
                              {schemaObj.type ? (
                                <span className="text-xs text-aki-text-muted">({String(schemaObj.type)})</span>
                              ) : null}
                            </div>
                            <button
                              onClick={() => navigator.clipboard.writeText(JSON.stringify(exampleJson, null, 2))}
                              className="p-1.5 hover:bg-aki-border rounded text-aki-text-muted hover:text-aki-text"
                              title="Copy example JSON"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                          {schemaObj.description ? (
                            <div className="px-3 py-2 border-b border-aki-border bg-aki-bg/50">
                              <p className="text-xs text-aki-text-muted">{String(schemaObj.description)}</p>
                            </div>
                          ) : null}
                          <div className="p-3 bg-aki-bg">
                            {/* Example JSON */}
                            <div className="mb-3">
                              <span className="text-[10px] text-aki-text-muted uppercase font-medium">Example JSON:</span>
                              <pre className="text-xs bg-aki-sidebar text-green-400 p-3 rounded mt-1 overflow-auto max-h-60 font-mono">
                                {JSON.stringify(exampleJson, null, 2)}
                              </pre>
                            </div>
                            {/* Schema Definition */}
                            <details>
                              <summary className="text-[10px] text-aki-text-muted uppercase cursor-pointer hover:text-aki-text">
                                Schema Definition
                              </summary>
                              <pre className="text-xs text-aki-text-muted overflow-auto mt-2 p-2 bg-aki-sidebar rounded">
                                {JSON.stringify(schema, null, 2)}
                              </pre>
                            </details>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Info Section */}
              {activeSection === 'info' && (
                <div className="p-4 space-y-4">
                  {parsedSpec.info?.contact && (
                    <div className="border border-aki-border rounded p-4">
                      <h3 className="font-medium text-aki-text mb-2">Contact</h3>
                      <div className="space-y-1 text-sm text-aki-text-muted">
                        {parsedSpec.info.contact.name && <p>Name: {parsedSpec.info.contact.name}</p>}
                        {parsedSpec.info.contact.email && <p>Email: {parsedSpec.info.contact.email}</p>}
                        {parsedSpec.info.contact.url && <p>URL: {parsedSpec.info.contact.url}</p>}
                      </div>
                    </div>
                  )}

                  {parsedSpec.info?.license && (
                    <div className="border border-aki-border rounded p-4">
                      <h3 className="font-medium text-aki-text mb-2">License</h3>
                      <div className="space-y-1 text-sm text-aki-text-muted">
                        <p>Name: {parsedSpec.info.license.name}</p>
                        {parsedSpec.info.license.url && <p>URL: {parsedSpec.info.license.url}</p>}
                      </div>
                    </div>
                  )}

                  {parsedSpec.components?.securitySchemes && (
                    <div className="border border-aki-border rounded p-4">
                      <h3 className="font-medium text-aki-text mb-2">Security Schemes</h3>
                      <div className="space-y-2">
                        {Object.entries(parsedSpec.components.securitySchemes).map(([name, scheme]) => (
                          <div key={name} className="p-2 bg-aki-sidebar rounded">
                            <span className="font-mono text-sm text-aki-accent">{name}</span>
                            <pre className="text-xs text-aki-text-muted mt-1">
                              {JSON.stringify(scheme, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-aki-text-muted">
              Start typing your OpenAPI specification...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

