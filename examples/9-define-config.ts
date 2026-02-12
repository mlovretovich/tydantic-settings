/**
 * defineConfig Example
 *
 * The recommended way to create application configuration with:
 * - Singleton pattern (cached after first load)
 * - Automatic schema + computed extraction from bundle
 * - Separator inheritance (resolvers inherit nestingSeparator from defineConfig)
 *
 * This dramatically simplifies configuration setup compared to manual
 * createSettings() usage.
 */
import {
  Settings,
  defineConfig,
  defineConfigSync,
  fromEnvironment,
  fromEnvironmentSync,
  fromDotenv,
  fromDotenvSync,
  type InferConfigType
} from '../src';

// =============================================================================
// 1. Define Your Configuration Schema
// =============================================================================

/**
 * Database configuration with computed connection URL.
 * This could be exported from a reusable configuration module.
 */
const DatabaseConfig = Settings(
  {
    host: Settings.String({ default: 'localhost' }),
    port: Settings.Number({ default: 5432 }),
    user: Settings.String({ default: 'postgres' }),
    password: Settings.Optional(Settings.String()),
    database: Settings.String({ default: 'myapp' })
  },
  {
    // Computed property - derives URL from other fields
    url: cfg => {
      const auth = cfg.password ? `${cfg.user}:${cfg.password}@` : `${cfg.user}@`;
      return `postgresql://${auth}${cfg.host}:${cfg.port}/${cfg.database}`;
    }
  }
);

/**
 * Application configuration composing DatabaseConfig.
 * Computed properties from nested bundles are auto-scoped!
 */
const AppConfig = Settings(
  {
    environment: Settings.Enum(
      { Development: 'development', Staging: 'staging', Production: 'production' },
      { default: 'development' }
    ),
    port: Settings.Number({ default: 3000 }),
    database: DatabaseConfig // Nested bundle - computed props come along!
  },
  {
    // App-level computed properties
    isDev: cfg => cfg.environment === 'development',
    isProduction: cfg => cfg.environment === 'production',
    baseUrl: cfg => `http://localhost:${cfg.port}`
  }
);

// Export the type for consumers
type AppConfigType = InferConfigType<typeof AppConfig>;

// =============================================================================
// 2. Create Configuration Singleton (Async - for API apps)
// =============================================================================

/**
 * Async configuration singleton using defineConfig.
 *
 * Features:
 * - Caches config after first load
 * - Resolvers inherit nestingSeparator automatically
 */
export const { getConfig, resetConfig } = defineConfig(AppConfig, {
  nestingSeparator: '__',
  resolvers: [fromEnvironment(), fromDotenv()] // Both inherit '__' separator
});

// =============================================================================
// 3. Create Configuration Singleton (Sync - for CLI tools)
// =============================================================================

/**
 * Sync configuration singleton using defineConfigSync.
 *
 * Use this for:
 * - CLI tools (Prisma migrations)
 * - Class constructors
 * - Any context where async isn't available
 */
export const { getConfig: getConfigSync, resetConfig: resetConfigSync } = defineConfigSync(
  AppConfig,
  {
    nestingSeparator: '__',
    resolvers: [fromEnvironmentSync(), fromDotenvSync()] // Both inherit '__' separator
  }
);

// =============================================================================
// 4. Usage Examples
// =============================================================================

async function asyncExample() {
  // Async usage (API apps)
  const config = await getConfig();

  console.log('Environment:', config.environment);
  console.log('Is Development:', config.isDev);
  console.log('Database URL:', config.database.url);
  console.log('Base URL:', config.baseUrl);

  // Second call returns cached instance
  const cachedConfig = await getConfig();
  console.log('Same instance:', config === cachedConfig); // true

  // Reset cache (useful for testing)
  resetConfig();
}

function syncExample() {
  // Sync usage (CLI tools, constructors)
  const config = getConfigSync();

  console.log('Database Host:', config.database.host);
  console.log('Database Port:', config.database.port);
}

// =============================================================================
// 5. Using AWS Secrets Manager (Advanced)
// =============================================================================

import { fromAwsSecretsManager } from '../src';

/**
 * Example with AWS Secrets Manager as a fallback resolver.
 */
export const { getConfig: getConfigWithAws } = defineConfig(AppConfig, {
  nestingSeparator: '__',
  resolvers: [
    fromEnvironment({ nestingSeparator: '__' }), // Highest priority
    fromAwsSecretsManager('myapp/config', 'us-east-1') // Fallback to AWS
  ]
});

// Run examples
asyncExample().catch(console.error);
syncExample();

export { AppConfig, AppConfigType };
