// OpenAPI Editor Types

export interface ParsedOpenAPI {
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

export interface PathOperation {
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

export interface OpenApiEditorProps {
  documentId?: string;
}

