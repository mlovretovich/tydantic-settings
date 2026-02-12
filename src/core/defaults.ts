import { Kind, TObject, TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { isObject } from '../utils';

/**
 * Recursively applies default values from a schema to a value.
 * Unlike Value.Default, this handles nested objects properly by:
 * 1. Creating nested objects if they don't exist but are object schemas
 * 2. Recursively applying defaults to all nested properties
 */
export function applyDefaults(schema: TSchema, value: any): any {
  // For object schemas with undefined input, start with empty object to allow defaults
  const input = value ?? {};

  // First apply top-level defaults
  // Type assertion needed due to potential version mismatch in monorepo
  const withDefaults = Value.Default(schema as any, input);

  // If this is an object schema, recursively apply defaults to nested properties
  if (schema[Kind] === 'Object' && isObject(withDefaults)) {
    const objectSchema = schema as TObject;
    const result = { ...withDefaults };

    for (const key in objectSchema.properties) {
      const propSchema = objectSchema.properties[key];

      // If the property is an object schema but doesn't exist in result,
      // create it so we can apply nested defaults
      if (!(key in result) && propSchema[Kind] === 'Object') {
        result[key] = {};
      }

      // Recurse if the property exists (including newly created objects)
      if (key in result) {
        result[key] = applyDefaults(propSchema, result[key]);
      }
    }

    return result;
  }

  return withDefaults;
}
