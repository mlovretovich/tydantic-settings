import { Settings, createSettings } from '../src/settings';
import { fromEnvironment, fromDotenv } from '../src/resolvers';

/**
 * Basic Configuration Example
 *
 * This example demonstrates a simple configuration setup with:
 * - A minimal schema with string and number types
 * - Default values
 * - Environment variable resolution
 * - .env file fallback
 */

// Define a simple schema
const AppConfigSchema = Settings({
  appName: Settings.String({ default: 'MyApp' }),
  port: Settings.Number({ default: 3000 }),
  logLevel: Settings.Enum(
    { Debug: 'debug', Info: 'info', Warn: 'warn', Error: 'error' },
    { default: 'info' }
  )
});

// Create configuration with priority: Environment > .env file
// Note: coerce defaults to true, which converts environment variable strings
// to the correct types (e.g., "3000" -> 3000)
const settings = await createSettings(AppConfigSchema, [fromEnvironment(), fromDotenv()], {
  coerce: true // Optional: explicitly enable type coercion (default)
});

console.log('Basic Configuration:', settings);
// Output example:
// {
//   appName: 'MyApp',
//   port: 3000,
//   logLevel: 'info'
// }

export default settings;
