// Settings creation APIs
export {
  createSettings,
  createSyncSettings,
  Settings,
  isSchemaWithComputed,
  defineConfig,
  defineConfigSync,
  type DefineConfigOptions
} from './settings';

// Resolvers
export {
  fromEnvironment,
  fromEnvironmentSync,
  fromDotenv,
  fromDotenvSync,
  fromAwsSecretsManager,
  type EnvironmentResolverOptions,
  type DotenvResolverOptions
} from './resolvers';

// Types
export {
  // Computed properties types
  type ComputedPropertyFunction,
  type ComputedProperties,
  // Schema with computed types
  type SchemaWithComputed,
  type InferComputedTypes,
  type ExtractStaticType,
  type InferPropertiesType,
  type InferConfigType,
  // Resolver types
  type ResolverContext,
  type SettingsResolver,
  type SyncSettingsResolver,
  // Deep readonly
  type DeepReadonly,
  // Re-export Static for convenience
  type Static
} from './types';

// Utilities
export { normalizeKey, isObject, deepFreeze } from './utils';
