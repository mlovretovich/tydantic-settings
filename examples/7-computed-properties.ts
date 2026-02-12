import { Settings, defineConfig } from '../src/settings';
import { fromEnvironment, fromDotenv } from '../src/resolvers';

/**
 * Computed Properties Example
 *
 * This example demonstrates how to add computed/derived properties to your configuration,
 * similar to Pydantic's @computed_field decorator.
 *
 * Computed properties:
 * - Are calculated from other configuration values
 * - Are added after validation
 * - Are accessed like regular properties
 * - Are read-only (implemented as getters)
 */

// Define sub-configs with their own computed properties
const DatabaseConfig = Settings(
  {
    host: Settings.String(),
    port: Settings.Number({ default: 5432 }),
    user: Settings.String(),
    password: Settings.String(),
    name: Settings.String({ default: 'myapp' })
  },
  {
    url: cfg => `postgresql://${cfg.user}:${cfg.password}@${cfg.host}:${cfg.port}/${cfg.name}`
  }
);

const RedisConfig = Settings(
  {
    host: Settings.String({ default: 'localhost' }),
    port: Settings.Number({ default: 6379 }),
    database: Settings.Number({ default: 0 })
  },
  {
    url: cfg => `redis://${cfg.host}:${cfg.port}/${cfg.database}`
  }
);

const ApiConfig = Settings(
  {
    host: Settings.String({ default: 'localhost' }),
    port: Settings.Number({ default: 3000 }),
    https: Settings.Boolean({ default: false })
  },
  {
    baseUrl: cfg => {
      const protocol = cfg.https ? 'https' : 'http';
      const portSuffix = (cfg.https && cfg.port === 443) || (!cfg.https && cfg.port === 80) ? '' : `:${cfg.port}`;
      return `${protocol}://${cfg.host}${portSuffix}`;
    }
  }
);

// Compose into a single app config — nested computed properties are auto-scoped!
const AppConfig = Settings(
  {
    environment: Settings.Enum(
      { Development: 'development', Production: 'production', Test: 'test' },
      { default: 'development' }
    ),
    database: DatabaseConfig,
    redis: RedisConfig,
    api: ApiConfig
  },
  {
    isProduction: cfg => cfg.environment === 'production',
    isDevelopment: cfg => cfg.environment === 'development'
  }
);

// Example environment variables:
process.env.DATABASE__HOST = 'postgres.example.com';
process.env.DATABASE__PORT = '5432';
process.env.DATABASE__USER = 'admin';
process.env.DATABASE__PASSWORD = 'secret123';
process.env.DATABASE__NAME = 'production_db';

process.env.REDIS__HOST = 'redis.example.com';
process.env.REDIS__PORT = '6379';

process.env.API__HOST = 'api.example.com';
process.env.API__PORT = '443';
process.env.API__HTTPS = 'true';

const { getConfig } = defineConfig(AppConfig, {
  nestingSeparator: '__',
  resolvers: [fromEnvironment(), fromDotenv()]
});

const settings = await getConfig();

console.log('Configuration with Computed Properties:\n');
console.log('Environment:', settings.environment);
console.log('Is Production:', settings.isProduction);
console.log('Is Development:', settings.isDevelopment);
console.log('\nDatabase Config:');
console.log('  Host:', settings.database.host);
console.log('  Port:', settings.database.port);
console.log('  User:', settings.database.user);
console.log('  Name:', settings.database.name);
console.log('  URL (computed):', settings.database.url);

console.log('\nRedis Config:');
console.log('  Host:', settings.redis.host);
console.log('  Port:', settings.redis.port);
console.log('  URL (computed):', settings.redis.url);

console.log('\nAPI Config:');
console.log('  Host:', settings.api.host);
console.log('  Port:', settings.api.port);
console.log('  HTTPS:', settings.api.https);
console.log('  Base URL (computed):', settings.api.baseUrl);

// JSON serialization includes computed properties
console.log('\n--- JSON Serialization ---');
console.log(JSON.stringify(settings, null, 2));

// Example output:
// {
//   "environment": "development",
//   "database": {
//     "host": "postgres.example.com",
//     "port": 5432,
//     "user": "admin",
//     "password": "secret123",
//     "name": "production_db",
//     "url": "postgresql://admin:secret123@postgres.example.com:5432/production_db"
//   },
//   "redis": {
//     "host": "redis.example.com",
//     "port": 6379,
//     "database": 0,
//     "url": "redis://redis.example.com:6379/0"
//   },
//   "api": {
//     "host": "api.example.com",
//     "port": 443,
//     "https": true,
//     "baseUrl": "https://api.example.com"
//   },
//   "isProduction": false,
//   "isDevelopment": true
// }

export default settings;
