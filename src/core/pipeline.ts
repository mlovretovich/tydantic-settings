import { Kind, TObject, TSchema, Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { normalizeKey, isObject, deepFreeze } from '../utils';
import { ComputedProperties } from '../types';

/**
 * Options for processing resolved configuration.
 */
export interface ProcessConfigOptions<T = any> {
  nestingSeparator?: string;
  coerce?: boolean;
  computed?: ComputedProperties<T>;
}

/**
 * Merges resolver results in priority order.
 * First resolver in the array has highest priority (wins conflicts).
 */
export function mergeResolverResults(
  results: Partial<Record<string, unknown>>[]
): Partial<Record<string, unknown>> {
  let merged: Partial<Record<string, unknown>> = {};
  // Iterate in reverse for priority (first resolver = highest priority)
  for (const result of [...results].reverse()) {
    merged = { ...merged, ...result };
  }
  return merged;
}

/**
 * Core configuration processing pipeline.
 * Shared by sync and async versions of createSettings.
 * Takes already-resolved config and processes it through:
 * 1. Unflatten (if separator provided)
 * 2. Apply defaults
 * 3. Coerce types (if enabled)
 * 4. Validate against schema
 * 5. Apply computed properties (if provided)
 */
export function processResolvedConfig<T extends TSchema>(
  schema: T,
  resolvedConfig: Partial<Record<string, unknown>>,
  options?: ProcessConfigOptions<Static<T>>
): Static<T> {
  // Un-flatten if separator is used
  const separator = options?.nestingSeparator;
  const nestedConfig = separator ? unflatten(resolvedConfig, separator) : resolvedConfig;

  // 1. Apply defaults recursively
  const configWithDefaults = applyDefaults(schema, nestedConfig) as Static<T>;

  // 2. Coerce types if enabled (default: true)
  const coerce = options?.coerce ?? true;
  const finalConfig = coerce
    ? (Value.Convert(schema as any, configWithDefaults) as Static<T>)
    : configWithDefaults;

  // 3. Validate against schema
  if (!Value.Check(schema as any, finalConfig)) {
    const errors = [...Value.Errors(schema as any, finalConfig)].map(
      e => `  - ${e.message} (at path: "${(e as any).path}")`
    );
    throw new Error(`\n❌ Invalid application configuration:\n${errors.join('\n')}`);
  }

  // 4. Apply computed properties if provided
  if (options?.computed) {
    applyComputedProperties(finalConfig as Record<string, any>, options.computed);
  }

  // 5. Deep freeze the config object for immutability
  deepFreeze(finalConfig as object);

  return finalConfig;
}

// ============================================================================
// Internal utilities (consolidated from defaults.ts, unflatten.ts, computed.ts)
// ============================================================================

/**
 * Recursively applies default values from a schema to a value.
 * Unlike Value.Default, this handles nested objects properly by:
 * 1. Creating nested objects if they don't exist but are object schemas
 * 2. Recursively applying defaults to all nested properties
 */
function applyDefaults(schema: TSchema, value: any): any {
  // For object schemas with undefined input, start with empty object to allow defaults
  const input = value ?? {};

  // First apply top-level defaults
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

/**
 * Un-flattens an object with delimited keys into a nested object.
 * @example
 * unflatten({ 'database__host': 'localhost' }, '__')
 * // returns { database: { host: 'localhost' } }
 */
function unflatten(obj: Record<string, unknown>, separator: string): Record<string, unknown> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    const parts = key.split(separator);
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = normalizeKey(parts[i]);
      current[part] = current[part] || {};
      current = current[part];
    }
    current[normalizeKey(parts[parts.length - 1])] = obj[key];
  }
  return result;
}

/**
 * Applies computed properties to a configuration object.
 * Computed properties are added using Object.defineProperty as enumerable getters.
 */
function applyComputedProperties<T extends Record<string, any>>(
  config: T,
  computed: ComputedProperties<T>
): T {
  for (const path in computed) {
    const computeFn = computed[path];
    const parts = path.split('.');

    // Navigate to the parent object
    let target: any = config;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in target)) {
        throw new Error(
          `Cannot add computed property "${path}": parent object "${parts
            .slice(0, i + 1)
            .join('.')}" does not exist`
        );
      }
      target = target[part];
    }

    const propertyName = parts[parts.length - 1];

    // Define the computed property as a getter
    Object.defineProperty(target, propertyName, {
      get: () => computeFn(config),
      enumerable: true, // Make it visible in console.log and JSON.stringify
      configurable: false, // Prevent deletion or reconfiguration
    });
  }

  return config;
}
