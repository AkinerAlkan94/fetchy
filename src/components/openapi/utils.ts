// OpenAPI Editor Utility Functions

import { ParsedOpenAPI } from './types';

// Helper function to resolve $ref references
export const resolveRef = (ref: string, spec: ParsedOpenAPI): Record<string, unknown> | null => {
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
export const generateExampleFromSchema = (
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
export const getSchemaTypeDisplay = (schema: Record<string, unknown>): string => {
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

