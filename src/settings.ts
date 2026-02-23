import { Type, TObject, TSchema, Static } from '@sinclair/typebox';
import { processResolvedConfig, mergeResolverResults, ProcessConfigOptions } from './core/pipeline';
import { isSchemaWithComputed, processNestedBundles } from './core/nested-bundles';
import {
  SchemaWithComputed,
  InferPropertiesType,
  InferConfigType,
  DeepReadonly,
  SettingsResolver,
  SyncSettingsResolver,
} from './types';

// ============================================================================
// Async Settings API
// ============================================================================

/**
 * Creates a validated, type-safe configuration object from a TypeBox schema
 * or SchemaWithComputed bundle and a prioritized list of async resolvers.
 *
 * @param schemaOrBundle The TypeBox schema or SchemaWithComputed bundle defining the configuration.
 * @param resolvers An array of async resolver functions, ordered from highest to lowest priority.
 * @param options Configuration options for the settings creation.
 * @param options.nestingSeparator Optional separator for nested keys (e.g., '__').
 * @param options.coerce Whether to coerce types (e.g., convert string "123" to number 123). Defaults to true.
 * @param options.computed Optional map of computed properties to add after validation (auto-extracted from bundle).
 * @returns A promise that resolves to the validated configuration object.
 *
 * @example
 * ```typescript
 * // With raw schema
 * const config = await createSettings(
 *   AppSchema,
 *   [fromEnvironment({ nestingSeparator: '__' })],
 *   { nestingSeparator: '__', computed: { ... } }
 * );
 *
 * // With bundle (computed auto-extracted)
 * const config = await createSettings(
 *   AppConfig,  // SchemaWithComputed bundle
 *   [fromEnvironment({ nestingSeparator: '__' })],
 *   { nestingSeparator: '__' }
 * );
 * ```
 */
// Overload 1: SchemaWithComputed bundle
export async function createSettings<TBundle extends SchemaWithComputed>(
  bundle: TBundle,
  resolvers: SettingsResolver[],
  options?: Omit<ProcessConfigOptions<InferConfigType<TBundle>>, 'computed'>
): Promise<DeepReadonly<InferConfigType<TBundle>>>;
// Overload 2: Raw schema (backward compatible)
export async function createSettings<T extends TSchema>(
  schema: T,
  resolvers: SettingsResolver[],
  options?: ProcessConfigOptions<Static<T>>
): Promise<DeepReadonly<Static<T>>>;
// Implementation
export async function createSettings(
  schemaOrBundle: TSchema | SchemaWithComputed,
  resolvers: SettingsResolver[],

  options?: ProcessConfigOptions
): Promise<any> {
  // Detect if first arg is a bundle
  const isBundle = isSchemaWithComputed(schemaOrBundle);
  const schema = isBundle ? schemaOrBundle.schema : schemaOrBundle;
  const finalOptions = isBundle ? { ...options, computed: schemaOrBundle.computed } : options;

  // Create context for resolvers (allows separator inheritance)
  const context = { nestingSeparator: options?.nestingSeparator };

  // Collect results from all async resolvers
  const results: Partial<Record<string, unknown>>[] = [];
  for (const resolver of resolvers) {
    results.push(await resolver(schema, context));
  }

  // Merge with priority (first resolver = highest priority)
  const resolvedConfig = mergeResolverResults(results);

  // Process through the shared pipeline
  return processResolvedConfig(schema, resolvedConfig, finalOptions);
}

// ============================================================================
// Sync Settings API
// ============================================================================

/**
 * Creates a validated, type-safe configuration object from a TypeBox schema
 * or SchemaWithComputed bundle and a prioritized list of synchronous resolvers.
 *
 * This is the synchronous counterpart to `createSettings`. Use this when all
 * your configuration sources are synchronous (e.g., environment variables,
 * in-memory objects).
 *
 * @param schemaOrBundle The TypeBox schema or SchemaWithComputed bundle defining the configuration.
 * @param resolvers An array of sync resolver functions, ordered from highest to lowest priority.
 * @param options Configuration options for the settings creation.
 * @param options.nestingSeparator Optional separator for nested keys (e.g., '__').
 * @param options.coerce Whether to coerce types (e.g., convert string "123" to number 123). Defaults to true.
 * @param options.computed Optional map of computed properties to add after validation (auto-extracted from bundle).
 * @returns The validated configuration object.
 *
 * @example
 * ```typescript
 * // With raw schema
 * const config = createSyncSettings(
 *   AppSchema,
 *   [fromEnvironmentSync({ nestingSeparator: '__' })],
 *   { nestingSeparator: '__', computed: { ... } }
 * );
 *
 * // With bundle (computed auto-extracted)
 * const config = createSyncSettings(
 *   AppConfig,  // SchemaWithComputed bundle
 *   [fromEnvironmentSync({ nestingSeparator: '__' })],
 *   { nestingSeparator: '__' }
 * );
 * ```
 */
// Overload 1: SchemaWithComputed bundle
export function createSyncSettings<TBundle extends SchemaWithComputed>(
  bundle: TBundle,
  resolvers: SyncSettingsResolver[],
  options?: Omit<ProcessConfigOptions<InferConfigType<TBundle>>, 'computed'>
): DeepReadonly<InferConfigType<TBundle>>;
// Overload 2: Raw schema (backward compatible)
export function createSyncSettings<T extends TSchema>(
  schema: T,
  resolvers: SyncSettingsResolver[],
  options?: ProcessConfigOptions<Static<T>>
): DeepReadonly<Static<T>>;
// Implementation
export function createSyncSettings(
  schemaOrBundle: TSchema | SchemaWithComputed,
  resolvers: SyncSettingsResolver[],

  options?: ProcessConfigOptions
): any {
  // Detect if first arg is a bundle
  const isBundle = isSchemaWithComputed(schemaOrBundle);
  const schema = isBundle ? schemaOrBundle.schema : schemaOrBundle;
  const finalOptions = isBundle ? { ...options, computed: schemaOrBundle.computed } : options;

  // Create context for resolvers (allows separator inheritance)
  const context = { nestingSeparator: options?.nestingSeparator };

  // Collect results from all resolvers
  const results: Partial<Record<string, unknown>>[] = [];
  for (const resolver of resolvers) {
    results.push(resolver(schema, context));
  }

  // Merge with priority (first resolver = highest priority)
  const resolvedConfig = mergeResolverResults(results);

  // Process through the shared pipeline
  return processResolvedConfig(schema, resolvedConfig, finalOptions);
}

// ============================================================================
// Settings() Unified API (Recommended)
// ============================================================================

// Type alias for empty computed object
type EmptyComputed = Record<string, never>;

/**
 * Creates a TypeBox object schema for configuration, with optional computed properties.
 *
 * **Overloaded API**:
 * - `Settings(props)` → returns plain TypeBox schema
 * - `Settings(props, computedProps)` → returns SchemaWithComputed bundle
 *
 * **Automatic Nesting**: When nested properties are SchemaWithComputed bundles,
 * their computed properties are automatically scoped and merged.
 *
 * @example
 * // Simple schema without computed properties
 * const SimpleConfig = Settings({
 *   host: Settings.String({ default: 'localhost' }),
 *   port: Settings.Number({ default: 3000 })
 * });
 *
 * @example
 * // Library defines config with computed properties
 * export const DatabaseConfig = Settings(
 *   {
 *     host: Settings.String({ default: 'localhost' }),
 *     port: Settings.Number({ default: 5432 }),
 *   },
 *   {
 *     url: cfg => `postgresql://${cfg.host}:${cfg.port}`
 *   }
 * );
 *
 * @example
 * // App nests library configs - computed properties come along automatically!
 * const AppConfig = Settings(
 *   {
 *     environment: Settings.String({ default: 'development' }),
 *     database: DatabaseConfig  // Pass the bundle, computed props come along
 *   },
 *   {
 *     isDev: cfg => cfg.environment === 'development'
 *   }
 * );
 *
 * // Result:
 * // config.environment      - from schema
 * // config.database.host    - from DatabaseConfig schema
 * // config.database.url     - from DatabaseConfig computed (auto-scoped!)
 * // config.isDev            - from app-level computed
 */
export function Settings<T extends Record<string, TSchema | SchemaWithComputed<any, any>>>(
  properties: T
): SchemaWithComputed<TObject, EmptyComputed, InferPropertiesType<T>>;
export function Settings<
  T extends Record<string, TSchema | SchemaWithComputed<any, any>>,
  TComputed extends Record<string, (config: any) => any>,
>(
  properties: T,
  computed: TComputed
): SchemaWithComputed<TObject, TComputed, InferPropertiesType<T>>;
export function Settings<
  T extends Record<string, TSchema | SchemaWithComputed<any, any>>,
  TComputed extends Record<string, (config: any) => any>,
>(properties: T, computed?: TComputed) {
  // Process nested bundles
  const { extractedProperties, collectedComputed } = processNestedBundles(properties);

  // Create the TypeBox schema
  const schema = Type.Object(extractedProperties);

  // Merge auto-collected computed with explicitly provided computed
  const finalComputed = {
    ...collectedComputed,
    ...(computed || {}),
  } as TComputed;

  return {
    schema,
    computed: finalComputed,
  };
}

// Attach static type helpers to Settings (TypeBox methods are standalone, no `this` binding)
/* eslint-disable @typescript-eslint/unbound-method */
Settings.String = Type.String;
Settings.Number = Type.Number;
Settings.Boolean = Type.Boolean;
Settings.Enum = Type.Enum;
Settings.Optional = Type.Optional;
Settings.Array = Type.Array;
Settings.Object = Type.Object;
Settings.Literal = Type.Literal;
Settings.Union = Type.Union;
/* eslint-enable @typescript-eslint/unbound-method */

// ============================================================================
// defineConfig - Singleton Factory (Async)
// ============================================================================

/**
 * Options for defineConfig and defineConfigSync.
 */
export interface DefineConfigOptions<TResolver = SettingsResolver> {
  /** Separator for nested keys (e.g., '__' for DATABASE__HOST) */
  nestingSeparator?: string;
  /** Resolvers to use for loading configuration */
  resolvers: TResolver[];
}

/**
 * Creates a singleton configuration factory with automatic schema/computed extraction.
 *
 * This is the recommended way to define application configuration:
 * - Encapsulates singleton caching pattern
 * - Automatically extracts schema and computed from bundle
 * - Separator inheritance: resolvers inherit `nestingSeparator` from options
 *
 * @param bundle The SchemaWithComputed bundle defining the configuration
 * @param options Configuration options including required resolvers
 * @returns Object with getConfig() and resetConfig() functions
 *
 * @example
 * ```typescript
 * // Resolvers inherit nestingSeparator automatically
 * export const { getConfig, resetConfig } = defineConfig(AppConfig, {
 *   nestingSeparator: '__',
 *   resolvers: [fromEnvironment(), fromDotenv()]  // Both inherit '__'
 * });
 *
 * // Or override per-resolver if needed
 * export const { getConfig } = defineConfig(AppConfig, {
 *   nestingSeparator: '__',
 *   resolvers: [
 *     fromEnvironment(),  // Inherits '__'
 *     fromDotenv({ nestingSeparator: '--' })  // Uses '--' instead
 *   ]
 * });
 *
 * // Usage
 * const config = await getConfig();
 * console.log(config.database.url);
 * ```
 */
export function defineConfig<TBundle extends SchemaWithComputed>(
  bundle: TBundle,
  options: DefineConfigOptions
): {
  getConfig: () => Promise<DeepReadonly<InferConfigType<TBundle>>>;
  resetConfig: () => void;
} {
  let instance: DeepReadonly<InferConfigType<TBundle>> | null = null;
  const separator = options.nestingSeparator;

  return {
    async getConfig(): Promise<DeepReadonly<InferConfigType<TBundle>>> {
      const current =
        instance ??
        (await createSettings(bundle, options.resolvers, { nestingSeparator: separator }));
      instance = current;
      return current;
    },
    resetConfig(): void {
      instance = null;
    },
  };
}

// ============================================================================
// defineConfigSync - Singleton Factory (Sync)
// ============================================================================

/**
 * Creates a synchronous singleton configuration factory.
 *
 * Use this for CLI tools (like Prisma migrations) that need configuration
 * at module load time before async operations are available.
 *
 * @param bundle The SchemaWithComputed bundle defining the configuration
 * @param options Configuration options including required resolvers
 * @returns Object with getConfig() and resetConfig() functions
 *
 * @example
 * ```typescript
 * // Resolvers inherit nestingSeparator automatically
 * export const { getConfig, resetConfig } = defineConfigSync(AppConfig, {
 *   nestingSeparator: '__',
 *   resolvers: [fromEnvironmentSync(), fromDotenvSync()]  // Both inherit '__'
 * });
 *
 * // Usage (synchronous!)
 * const config = getConfig();
 * console.log(config.database.url);
 * ```
 */
export function defineConfigSync<TBundle extends SchemaWithComputed>(
  bundle: TBundle,
  options: DefineConfigOptions<SyncSettingsResolver>
): {
  getConfig: () => DeepReadonly<InferConfigType<TBundle>>;
  resetConfig: () => void;
} {
  let instance: DeepReadonly<InferConfigType<TBundle>> | null = null;
  const separator = options.nestingSeparator;

  return {
    getConfig(): DeepReadonly<InferConfigType<TBundle>> {
      const current =
        instance ?? createSyncSettings(bundle, options.resolvers, { nestingSeparator: separator });
      instance = current;
      return current;
    },
    resetConfig(): void {
      instance = null;
    },
  };
}
