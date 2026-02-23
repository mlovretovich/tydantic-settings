import { Settings, createSettings, fromEnvironment, type SettingsResolver, normalizeKey } from '../src';
import { TObject, TSchema } from '@sinclair/typebox';

/**
 * Custom Resolver Example
 *
 * This example demonstrates how to create custom resolvers:
 * - fromJsonFile: Load configuration from a JSON file
 * - fromConsul: Fetch configuration from HashiCorp Consul (mock)
 * - fromRemoteApi: Fetch configuration from a REST API (mock)
 * - Combining custom resolvers with built-in ones
 */

// Custom Resolver 1: Load from JSON file
function fromJsonFile(filePath: string): SettingsResolver {
  return async (schema: TSchema) => {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      return data;
    } catch (error) {
      console.warn(`Could not load config from ${filePath}:`, error);
      return {};
    }
  };
}

// Custom Resolver 2: Load from HashiCorp Consul (mock implementation)
function fromConsul(
  consulUrl: string,
  keyPrefix: string,
  options?: { caseSensitive?: boolean }
): SettingsResolver {
  const caseSensitive = options?.caseSensitive ?? false;

  return async (schema: TSchema) => {
    try {
      // Mock implementation - in real code, use the Consul HTTP API
      console.log(`Fetching config from Consul: ${consulUrl}/${keyPrefix}`);

      // Simulate API call
      const mockConsulData = {
        'app/database/host': 'consul-db.example.com',
        'app/database/port': '5432',
        'app/cache/host': 'consul-redis.example.com'
      };

      const config: Record<string, unknown> = {};
      const schemaKeys = Object.keys((schema as TObject).properties);

      for (const [consulKey, value] of Object.entries(mockConsulData)) {
        if (consulKey.startsWith(keyPrefix)) {
          // Convert consul/key/path to nested structure
          const configKey = consulKey.replace(`${keyPrefix}/`, '').replace(/\//g, '__');

          if (caseSensitive) {
            config[configKey] = value;
          } else {
            const normalizedKey = normalizeKey(configKey.split('__')[0]);
            if (schemaKeys.some(sk => normalizeKey(sk) === normalizedKey)) {
              config[configKey] = value;
            }
          }
        }
      }

      return config;
    } catch (error) {
      console.warn('Could not fetch config from Consul:', error);
      return {};
    }
  };
}

// Custom Resolver 3: Load from a remote API
function fromRemoteApi(apiUrl: string, apiKey: string): SettingsResolver {
  return async (schema: TSchema) => {
    try {
      // Mock implementation - in real code, use fetch or axios
      console.log(`Fetching config from API: ${apiUrl}`);

      // Simulate API call
      const mockApiResponse = {
        database: {
          host: 'api-db.example.com',
          port: 5432
        },
        features: {
          enableNewUi: true
        }
      };

      return mockApiResponse;
    } catch (error) {
      console.warn('Could not fetch config from remote API:', error);
      return {};
    }
  };
}

// Custom Resolver 4: Load from command-line arguments
function fromCommandLine(): SettingsResolver {
  return async (schema: TSchema) => {
    const config: Record<string, unknown> = {};
    const args = process.argv.slice(2);

    for (const arg of args) {
      // Parse arguments like --database__host=localhost
      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        if (key && value) {
          config[key] = value;
        }
      }
    }

    return config;
  };
}

// Define the schema
const CustomResolverSchema = Settings({
  database: Settings({
    host: Settings.String({ default: 'localhost' }),
    port: Settings.Number({ default: 5432 })
  }),
  cache: Settings({
    host: Settings.String({ default: 'localhost' }),
    port: Settings.Number({ default: 6379 })
  }),
  features: Settings({
    enableNewUi: Settings.Boolean({ default: false })
  })
});

// Combine custom resolvers with built-in ones
// Priority (highest to lowest):
// 1. Command-line arguments
// 2. Environment variables
// 3. Remote API
// 4. Consul
// 5. JSON file
const settings = await createSettings(
  CustomResolverSchema,
  [
    fromCommandLine(),
    fromEnvironment({ nestingSeparator: '__' }),
    fromRemoteApi('https://config.example.com/api/config', 'api-key-123'),
    fromConsul('http://consul.example.com:8500', 'app', { caseSensitive: false }),
    fromJsonFile('./config.json')
  ],
  { nestingSeparator: '__' }
);

console.log('Configuration with custom resolvers:', JSON.stringify(settings, null, 2));

// Usage examples:
//
// 1. Run with command-line arguments:
//    node 5-custom-resolver.js --database__host=cmdline-db.com --cache__port=6380
//
// 2. Set environment variables:
//    export DATABASE__HOST=env-db.com
//    export FEATURES__ENABLE_NEW_UI=true
//
// 3. Create config.json:
//    {
//      "database": { "host": "json-db.com", "port": 5433 },
//      "cache": { "host": "json-redis.com" }
//    }
//
// The final config will merge all sources with command-line having highest priority

export default settings;
