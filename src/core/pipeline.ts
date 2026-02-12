import { TSchema, Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { applyDefaults } from './defaults';
import { unflatten } from './unflatten';
import { applyComputedProperties, ComputedProperties } from './computed';
import { deepFreeze } from '../utils';

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
