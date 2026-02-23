import {
  Settings,
  defineConfig,
  fromEnvironment,
  fromDotenv,
  fromAwsSecretsManager,
  type InferConfigType
} from '../src';

/**
 * Real-World Config Example with Computed Properties
 *
 * Demonstrates a typical application config that:
 * - Defines a reusable DatabaseConfig bundle with a computed URL
 * - Composes it into an AppConfig with environment-level computed properties
 * - Uses defineConfig for singleton caching
 * - Falls back through environment → AWS → .env
 */

// Reusable database config bundle with computed connection URL
const DatabaseConfig = Settings(
  {
    host: Settings.String(),
    port: Settings.Number({ default: 5432 }),
    user: Settings.String(),
    password: Settings.String()
  },
  {
    url: cfg => `postgresql://${cfg.user}:${cfg.password}@${cfg.host}:${cfg.port}`
  }
);

// Application config composing the database bundle
const AppConfig = Settings(
  {
    environment: Settings.Enum(
      { Development: 'development', Production: 'production', Test: 'test' },
      { default: 'development' }
    ),
    database: DatabaseConfig, // Nested bundle — computed props auto-scoped
    apiKey: Settings.Optional(Settings.String())
  },
  {
    isDev: cfg => cfg.environment === 'development'
  }
);

type AppConfigType = InferConfigType<typeof AppConfig>;

// Singleton config — resolvers inherit nestingSeparator
const separator = '__';
export const { getConfig, resetConfig } = defineConfig(AppConfig, {
  nestingSeparator: separator,
  resolvers: [
    fromEnvironment(), // Highest priority
    fromAwsSecretsManager(process.env.AWS_SECRET_ID!, process.env.AWS_REGION!),
    fromDotenv() // Lowest priority
  ]
});

// Usage
const config = await getConfig();

// Computed properties are fully typed and auto-scoped
console.log('Database URL:', config.database.url);
// Output: postgresql://admin:secret123@localhost:5432

console.log('Is Dev:', config.isDev);

console.log('Database Config:', {
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  url: config.database.url // No type casting needed
});

export { AppConfig, type AppConfigType };
