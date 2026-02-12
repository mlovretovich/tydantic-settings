import { Settings, createSettings } from '../src/settings';
import { fromEnvironment, fromDotenv } from '../src/resolvers';

/**
 * Multi-Environment Configuration Example
 *
 * This example demonstrates how to configure an application for multiple environments:
 * - Development, Staging, and Production environments
 * - Environment-specific settings
 * - Different .env files per environment
 * - Feature flags
 */

const MultiEnvSchema = Settings({
  environment: Settings.Enum(
    { Development: 'development', Staging: 'staging', Production: 'production' },
    { default: 'development' }
  ),
  server: Settings({
    host: Settings.String({ default: 'localhost' }),
    port: Settings.Number({ default: 3000 }),
    cors: Settings.Boolean({ default: true })
  }),
  features: Settings({
    enableAnalytics: Settings.Boolean({ default: false }),
    enableBetaFeatures: Settings.Boolean({ default: false }),
    maintenanceMode: Settings.Boolean({ default: false })
  }),
  logging: Settings({
    level: Settings.Enum(
      { Debug: 'debug', Info: 'info', Warn: 'warn', Error: 'error' },
      { default: 'info' }
    ),
    prettyPrint: Settings.Boolean({ default: true })
  })
});

// Determine which .env file to use based on NODE_ENV
const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : process.env.NODE_ENV === 'staging'
    ? '.env.staging'
    : '.env.development';

const settings = await createSettings(
  MultiEnvSchema,
  [
    fromEnvironment({ nestingSeparator: '__' }),
    fromDotenv({ path: envFile, nestingSeparator: '__' })
  ],
  { nestingSeparator: '__' }
);

console.log(`Configuration for ${settings.environment} environment:`, settings);

// Example .env.development:
// ENVIRONMENT=development
// SERVER__HOST=localhost
// SERVER__PORT=3000
// FEATURES__ENABLE_BETA_FEATURES=true
// LOGGING__LEVEL=debug
// LOGGING__PRETTY_PRINT=true

// Example .env.production:
// ENVIRONMENT=production
// SERVER__HOST=0.0.0.0
// SERVER__PORT=8080
// SERVER__CORS=false
// FEATURES__ENABLE_ANALYTICS=true
// LOGGING__LEVEL=warn
// LOGGING__PRETTY_PRINT=false

export default settings;
