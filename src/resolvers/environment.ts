import { TObject, TSchema } from '@sinclair/typebox';
import { normalizeKey } from '../utils';
import { SettingsResolver, SyncSettingsResolver, ResolverContext } from '../types';

/**
 * Options for environment variable resolvers.
 */
export interface EnvironmentResolverOptions {
  /** Optional separator for nested keys (e.g., '__'). Inherited from defineConfig if not specified. */
  nestingSeparator?: string;
  /** Whether to match keys case-sensitively. Defaults to false. */
  caseSensitive?: boolean;
  /**
   * Optional prefix to filter and strip from environment variables.
   * Only variables starting with this prefix will be resolved.
   * The prefix is stripped from the key in the result.
   *
   * @example
   * // With prefix: 'DATABASE__'
   * // DATABASE__HOST=localhost -> { HOST: 'localhost' }
   * // DATABASE__PORT=5432 -> { PORT: '5432' }
   * // OTHER_VAR=value -> (ignored)
   */
  prefix?: string;
}

/**
 * Core environment variable resolution logic.
 * Shared by sync and async versions.
 */
function resolveFromEnvironment(
  schema: TSchema,
  options?: EnvironmentResolverOptions,
  context?: ResolverContext
): Partial<Record<string, unknown>> {
  const caseSensitive = options?.caseSensitive ?? false;
  // Use resolver's own separator, or inherit from context
  const separator = options?.nestingSeparator ?? context?.nestingSeparator;
  const prefix = options?.prefix;
  const config: Partial<Record<string, unknown>> = {};
  const schemaKeys = Object.keys((schema as TObject).properties);

  for (const envKey in process.env) {
    const envValue = process.env[envKey];
    if (envValue === undefined) continue;

    // If prefix is specified, only process keys that start with it
    if (prefix) {
      const prefixMatch = caseSensitive
        ? envKey.startsWith(prefix)
        : envKey.toUpperCase().startsWith(prefix.toUpperCase());

      if (!prefixMatch) continue;

      // Strip the prefix from the key
      const strippedKey = envKey.slice(prefix.length);
      config[strippedKey] = envValue;
      continue;
    }

    if (caseSensitive) {
      // If case-sensitive, only look for exact matches in the top-level schema keys.
      if (schemaKeys.includes(envKey)) {
        config[envKey] = envValue;
      }
      continue;
    }

    // Case-insensitive and nesting-aware matching.
    const normalizedEnvKey = normalizeKey(envKey);
    const normalizedSchemaKey = separator
      ? normalizeKey(envKey.split(separator)[0])
      : normalizedEnvKey;

    if (schemaKeys.some(sk => normalizeKey(sk) === normalizedSchemaKey)) {
      config[envKey] = envValue;
    }
  }
  return config;
}

/**
 * Creates an async resolver that reads from environment variables.
 *
 * @param options Resolver options
 * @param options.nestingSeparator Optional separator for nested keys (e.g., '__').
 *   If not specified, inherits from defineConfig's nestingSeparator.
 * @param options.caseSensitive Whether to match keys case-sensitively. Defaults to false.
 * @param options.prefix Optional prefix to filter and strip from environment variables.
 * @returns An async resolver function
 *
 * @example
 * ```typescript
 * // Inherits separator from defineConfig
 * export const { getConfig } = defineConfig(AppConfig, {
 *   nestingSeparator: '__',
 *   resolvers: [fromEnvironment(), fromDotenv()]  // Both inherit '__'
 * });
 *
 * // With prefix - only reads DATABASE__* variables, strips prefix
 * // DATABASE__HOST=localhost -> config.host = 'localhost'
 * export const { getConfig } = defineConfig(DatabaseConfig, {
 *   nestingSeparator: '__',
 *   resolvers: [fromEnvironment({ prefix: 'DATABASE__' })]
 * });
 * ```
 */
export function fromEnvironment(options?: EnvironmentResolverOptions): SettingsResolver {
  return async (schema: TSchema, context?: ResolverContext) =>
    resolveFromEnvironment(schema, options, context);
}

/**
 * Creates a synchronous resolver that reads from environment variables.
 *
 * @param options Resolver options
 * @param options.nestingSeparator Optional separator for nested keys (e.g., '__').
 *   If not specified, inherits from defineConfigSync's nestingSeparator.
 * @param options.caseSensitive Whether to match keys case-sensitively. Defaults to false.
 * @param options.prefix Optional prefix to filter and strip from environment variables.
 * @returns A sync resolver function
 *
 * @example
 * ```typescript
 * // Inherits separator from defineConfigSync
 * export const { getConfig } = defineConfigSync(AppConfig, {
 *   nestingSeparator: '__',
 *   resolvers: [fromEnvironmentSync(), fromDotenvSync()]  // Both inherit '__'
 * });
 *
 * // With prefix - only reads DATABASE__* variables, strips prefix
 * // DATABASE__HOST=localhost -> config.host = 'localhost'
 * export const { getConfig } = defineConfigSync(DatabaseConfig, {
 *   nestingSeparator: '__',
 *   resolvers: [fromEnvironmentSync({ prefix: 'DATABASE__' })]
 * });
 * ```
 */
export function fromEnvironmentSync(options?: EnvironmentResolverOptions): SyncSettingsResolver {
  return (schema: TSchema, context?: ResolverContext) =>
    resolveFromEnvironment(schema, options, context);
}
