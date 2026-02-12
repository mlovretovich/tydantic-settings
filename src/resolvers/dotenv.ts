import { TSchema } from '@sinclair/typebox';
import { config as dotenvConfig } from 'dotenv';
import { SettingsResolver, SyncSettingsResolver, ResolverContext } from '../types';
import { fromEnvironment, fromEnvironmentSync, EnvironmentResolverOptions } from './environment';

/**
 * Options for dotenv resolvers.
 */
export interface DotenvResolverOptions extends EnvironmentResolverOptions {
  /** Path to the .env file */
  path?: string;
}

/**
 * Creates an async resolver that reads configuration from a .env file.
 * It uses the `dotenv` package to load the file into `process.env` first.
 *
 * @param options Resolver options
 * @param options.path Path to the .env file
 * @param options.nestingSeparator Optional separator for nested keys (e.g., '__').
 *   If not specified, inherits from defineConfig's nestingSeparator.
 * @param options.caseSensitive Whether to match keys case-sensitively. Defaults to false.
 * @param options.prefix Optional prefix to filter and strip from environment variables.
 * @returns An async resolver function
 */
export function fromDotenv(options?: DotenvResolverOptions): SettingsResolver {
  return async (schema: TSchema, context?: ResolverContext) => {
    dotenvConfig({ path: options?.path }); // Load .env file into process.env
    // Then, delegate to the environment resolver to pick the values.
    return fromEnvironment(options)(schema, context);
  };
}

/**
 * Creates a synchronous resolver that reads from a .env file.
 *
 * @param options Resolver options
 * @param options.path Path to the .env file
 * @param options.nestingSeparator Optional separator for nested keys (e.g., '__').
 *   If not specified, inherits from defineConfigSync's nestingSeparator.
 * @param options.caseSensitive Whether to match keys case-sensitively. Defaults to false.
 * @param options.prefix Optional prefix to filter and strip from environment variables.
 * @returns A sync resolver function
 */
export function fromDotenvSync(options?: DotenvResolverOptions): SyncSettingsResolver {
  return (schema: TSchema, context?: ResolverContext) => {
    dotenvConfig({ path: options?.path });
    return fromEnvironmentSync(options)(schema, context);
  };
}
