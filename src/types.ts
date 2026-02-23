import { Static, TObject, TSchema } from '@sinclair/typebox';

// ============================================================================
// Computed Properties Types
// ============================================================================

/**
 * A function that computes a value based on the validated configuration.
 * Computed properties are added after validation and can access other config values.
 */
export type ComputedPropertyFunction<T = any> = (config: T) => any;

/**
 * A map of computed property paths to their computation functions.
 * The path uses dot notation for nested properties (e.g., 'database.url').
 */
export type ComputedProperties<T = any> = Record<string, ComputedPropertyFunction<T>>;

// ============================================================================
// Schema With Computed Types
// ============================================================================

/**
 * A schema bundled with its computed properties.
 * This allows libraries to export both schema and computed properties together,
 * making it easier for applications to compose multiple library configurations.
 */
export interface SchemaWithComputed<
  TSchemaType extends TObject = TObject,
  TComputed extends ComputedProperties<any> = ComputedProperties<any>,
  TInferredType = any,
> {
  schema: TSchemaType;
  computed: TComputed;
  /** Type hint for InferConfigType - reflects the actual object shape including nested bundles */
  _inferredType?: TInferredType;
}

/**
 * Infers the return types of computed property functions.
 */
export type InferComputedTypes<TComputed extends Record<string, (config: any) => any>> = {
  [K in keyof TComputed]: ReturnType<TComputed[K]>;
};

/**
 * Extracts the static type from a SchemaWithComputed bundle or a plain schema.
 * For bundles, this includes both the schema type AND computed properties.
 * For bundles with a TInferredType hint, uses that for proper nested type inference.
 */
export type ExtractStaticType<T> =
  T extends SchemaWithComputed<infer S, infer C, infer I>
    ? (I extends Static<S> ? I : Static<S>) & InferComputedTypes<C>
    : T extends TSchema
      ? Static<T>
      : never;

/**
 * Maps a record of properties to their static type equivalents.
 * This produces the final object type shape.
 */
export type InferPropertiesType<T extends Record<string, TSchema | SchemaWithComputed<any, any>>> =
  {
    [K in keyof T]: ExtractStaticType<T[K]>;
  };

/**
 * Infers the full configuration type from a SchemaWithComputed bundle.
 * Includes both schema properties and computed properties.
 *
 * Uses the _inferredType hint when available for proper nested type inference,
 * otherwise falls back to Static<schema>.
 *
 * @example
 * ```typescript
 * const DatabaseConfig = Settings({ host: Settings.String() }, { url: cfg => `...` });
 * type DatabaseConfigType = InferConfigType<typeof DatabaseConfig>;
 * // { host: string; url: string }
 * ```
 */
export type InferConfigType<T extends SchemaWithComputed<any, any, any>> =
  (T extends SchemaWithComputed<any, any, infer I> ? I : Static<T['schema']>) &
    InferComputedTypes<T['computed']>;

// ============================================================================
// Resolver Types
// ============================================================================

/**
 * Context passed to resolvers from defineConfig/createSettings.
 * Allows resolvers to inherit settings like nestingSeparator.
 */
export interface ResolverContext {
  /** Separator for nested keys, inherited from defineConfig if not specified in resolver */
  nestingSeparator?: string;
}

/**
 * A function that asynchronously resolves a partial configuration.
 * This is the building block for all our configuration sources.
 *
 * @param schema - The TypeBox schema defining the configuration structure
 * @param context - Optional context with inherited settings (e.g., nestingSeparator)
 */
export type SettingsResolver = (
  schema: TSchema,
  context?: ResolverContext
) => Promise<Partial<Record<string, unknown>>>;

/**
 * A function that synchronously resolves a partial configuration.
 * This is the synchronous counterpart to SettingsResolver.
 *
 * @param schema - The TypeBox schema defining the configuration structure
 * @param context - Optional context with inherited settings (e.g., nestingSeparator)
 */
export type SyncSettingsResolver = (
  schema: TSchema,
  context?: ResolverContext
) => Partial<Record<string, unknown>>;

// ============================================================================
// Deep Readonly
// ============================================================================

/**
 * Recursively makes all properties of T readonly.
 * Configuration objects are deeply frozen at runtime; this type reflects that at compile time.
 */
export type DeepReadonly<T> = T extends (infer R)[]
  ? ReadonlyArray<DeepReadonly<R>>
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

// ============================================================================
// Re-export Static for convenience
// ============================================================================

export { type Static } from '@sinclair/typebox';
