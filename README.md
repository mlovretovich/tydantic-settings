# Tydantic Settings

A flexible, type-safe configuration management library for TypeScript applications, inspired by [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) and built on [TypeBox](https://github.com/sinclairzx81/typebox).

Define your configuration schema once and resolve values from multiple sources (environment variables, `.env` files, AWS Secrets Manager, and more) with a clear priority order.

## Features

- ✅ **Type-Safe**: Leverages TypeBox for schema definition and runtime validation
- ✅ **Multiple Sources**: Environment variables, `.env` files, AWS Secrets Manager, and custom resolvers
- ✅ **Priority-based Merging**: Resolvers are processed in order, allowing overrides
- ✅ **Nested Configuration**: Supports deeply nested objects via delimited keys (e.g., `DATABASE__HOST`)
- ✅ **Automatic Type Coercion**: Converts string values to proper types (`'5432'` → `5432`, `'true'` → `true`)
- ✅ **Case-Insensitive Matching**: Matches `DATABASE_HOST` to `databaseHost` automatically
- ✅ **Computed Properties**: Add derived fields like Pydantic's `@computed_field`
- ✅ **Extensible**: Create custom resolvers for any configuration source

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Configuration Schema](#configuration-schema)
  - [Resolvers](#resolvers)
  - [Nested Configuration](#nested-configuration)
- [Advanced Features](#advanced-features)
  - [Computed Properties](#settings-with-computed-properties-recommended)
  - [Automatic Nested Computed Properties](#automatic-nested-computed-properties)
  - [Immutable Configuration](#immutable-configuration)
  - [Type Coercion](#type-coercion)
  - [Custom Resolvers](#custom-resolvers)
- [API Reference](#api-reference)
- [TypeScript Support](#typescript-support)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [Comparison with Pydantic Settings](#comparison-with-pydantic-settings)

## Installation

```bash
npm install tydantic-settings
```

### Optional: AWS Secrets Manager

To use the `fromAwsSecretsManager()` resolver, install the AWS SDK:

```bash
npm install @aws-sdk/client-secrets-manager
```

This dependency is optional — if you only use `fromEnvironment()` or `fromDotenv()`, you don't need it.

## Quick Start

### 1. Define Your Schema with `Settings()`

The new `Settings()` function provides a clean, unified API for defining configuration schemas with optional computed properties.

```typescript
import { Settings } from 'tydantic-settings';

// Simple schema without computed properties
const SimpleConfig = Settings({
  host: Settings.String({ default: 'localhost' }),
  port: Settings.Number({ default: 3000 })
});

// Schema with computed properties
const DatabaseConfig = Settings(
  {
    host: Settings.String({ default: 'localhost' }),
    port: Settings.Number({ default: 5432 }),
    user: Settings.String({ default: 'postgres' }),
    password: Settings.Optional(Settings.String()),
    database: Settings.String({ default: 'myapp' })
  },
  {
    // Computed properties - second argument
    url: cfg => `postgresql://${cfg.user}:${cfg.password}@${cfg.host}:${cfg.port}/${cfg.database}`
  }
);
```

### 2. Compose Configs with Automatic Nesting

When you nest a schema bundle, its computed properties come along automatically:

```typescript
import { Settings } from 'tydantic-settings';
import { DatabaseConfig } from './database-config'; // Your reusable config bundle

const AppConfig = Settings(
  {
    environment: Settings.String({ default: 'development' }),
    database: DatabaseConfig // Pass the bundle - computed props auto-scoped!
  },
  {
    isDev: cfg => cfg.environment === 'development',
    isProduction: cfg => cfg.environment === 'production'
  }
);
```

### 3. Create Configuration Singleton with `defineConfig` (Recommended)

The simplest way to create application configuration:

```typescript
import {
  Settings,
  defineConfig,
  fromEnvironment,
  fromDotenv,
  type InferConfigType
} from 'tydantic-settings';

export const AppConfig = Settings(
  {
    /* schema properties */
  },
  {
    /* computed properties */
  }
);

export type AppConfigType = InferConfigType<typeof AppConfig>;

// Singleton pattern - resolvers inherit nestingSeparator automatically
export const { getConfig, resetConfig } = defineConfig(AppConfig, {
  nestingSeparator: '__',
  resolvers: [fromEnvironment(), fromDotenv()] // Both inherit '__'
});
```

**Benefits:**

- Encapsulates singleton caching pattern
- Automatically extracts schema and computed from bundle
- **Separator inheritance**: resolvers without a `nestingSeparator` inherit from `defineConfig`
- Resolvers can override with their own separator if needed

### 3b. Alternative: Manual Settings Creation

For one-shot configuration (no singleton caching):

```typescript
import { createSettings, fromEnvironment, fromDotenv } from 'tydantic-settings';

const settings = await createSettings(
  AppConfig, // Pass bundle directly (schema + computed auto-extracted)
  [
    fromEnvironment({ nestingSeparator: '__' }), // Highest priority
    fromDotenv({ nestingSeparator: '__' }) // Fallback
  ],
  { nestingSeparator: '__' }
);
```

### 4. Use Your Typed Settings

```typescript
// Regular properties
console.log(settings.database.host); // Type: string
console.log(settings.database.port); // Type: number
console.log(settings.environment); // Type: string

// Computed properties (auto-scoped from DatabaseConfig!)
console.log(settings.database.url); // Type: string - computed
console.log(settings.isDev); // Type: boolean - computed
```

### Synchronous Usage (for Prisma CLI, constructors, etc.)

```typescript
import { defineConfigSync, fromEnvironmentSync, fromDotenvSync } from 'tydantic-settings';

// Use defineConfigSync for CLI tools - resolvers inherit separator
export const { getConfig, resetConfig } = defineConfigSync(AppConfig, {
  nestingSeparator: '__',
  resolvers: [fromEnvironmentSync(), fromDotenvSync()] // Both inherit '__'
});

const config = getConfig(); // Synchronous!
```

For manual control:

```typescript
import { createSyncSettings, fromEnvironmentSync } from 'tydantic-settings';

const config = createSyncSettings(
  DatabaseConfig, // Pass bundle directly
  [fromEnvironmentSync({ nestingSeparator: '__' })],
  { nestingSeparator: '__' }
);
```

## Core Concepts

### Configuration Schema

Use `Settings()` to define your configuration structure. It provides all TypeBox types as static helpers:

```typescript
const Schema = Settings({
  // Primitives
  appName: Settings.String({ default: 'MyApp' }),
  port: Settings.Number({ default: 3000 }),
  debug: Settings.Boolean({ default: false }),

  // Enums
  logLevel: Settings.Enum(
    { Debug: 'debug', Info: 'info', Warn: 'warn' },
    { default: 'info' }
  ),

  // Nested objects
  database: Settings({
    host: Settings.String(),
    port: Settings.Number({ default: 5432 })
  }),

  // Optional fields
  apiKey: Settings.Optional(Settings.String())
});
```

### Resolvers

Resolvers fetch configuration from different sources. They're processed in order, with the first resolver having the highest priority.

#### Built-in Resolvers

**`fromEnvironment(options?)`**

Reads from `process.env`:

```typescript
fromEnvironment({
  caseSensitive: false, // Default: false
  nestingSeparator: '__', // For nested keys (inherited from defineConfig if not specified)
  prefix: 'DATABASE__' // Optional: filter and strip prefix from env vars
});
```

**Prefix example** - useful for scoping configuration to a namespace:

```typescript
// With DATABASE__HOST=localhost, DATABASE__PORT=5432
const resolver = fromEnvironment({ prefix: 'DATABASE__' });
// Resolves to: { HOST: 'localhost', PORT: '5432' }
```

**`fromDotenv(options?)`**

Loads a `.env` file into `process.env`:

```typescript
fromDotenv({
  path: '.env.production', // Default: '.env'
  caseSensitive: false,
  nestingSeparator: '__', // Inherited from defineConfig if not specified
  prefix: 'APP__' // Optional: filter and strip prefix
});
```

**`fromAwsSecretsManager(secretId, region, options?)`**

> Requires `@aws-sdk/client-secrets-manager` — see [Installation](#optional-aws-secrets-manager).

Fetches secrets from AWS Secrets Manager:

```typescript
fromAwsSecretsManager(
  'myapp/database', // Secret ID or ARN
  'us-east-1', // AWS region
  { caseSensitive: false }
);

// Multiple secrets
fromAwsSecretsManager(['myapp/database', 'myapp/api-keys'], 'us-east-1');
```

#### Priority Example

```typescript
const settings = await createSettings(
  Schema,
  [
    fromEnvironment(),              // 1st priority (highest)
    fromAwsSecretsManager(...),     // 2nd priority
    fromDotenv({ path: '.env' }),   // 3rd priority (lowest)
  ]
);
```

If `DATABASE__HOST` is set in both environment variables and `.env`, the environment variable wins.

### Nested Configuration

Use a separator (like `__`) to represent nested objects in flat environment variables:

```bash
# .env file
DATABASE__HOST=localhost
DATABASE__PORT=5432
DATABASE__POOL__MIN=2
DATABASE__POOL__MAX=10
```

```typescript
const Schema = Settings({
  database: Settings({
    host: Settings.String(),
    port: Settings.Number(),
    pool: Settings({
      min: Settings.Number(),
      max: Settings.Number(),
    }),
  }),
});

const { getConfig } = defineConfig(Schema, {
  nestingSeparator: '__',
  resolvers: [fromEnvironment(), fromDotenv()]
});

const settings = await getConfig();
settings.database.pool.min; // 2
```

## Advanced Features

### Settings() with Computed Properties (Recommended)

The `Settings()` function is the recommended way to define schemas with computed properties:

```typescript
import { Settings } from 'tydantic-settings';

// Library defines its config with computed properties
export const DatabaseConfig = Settings(
  {
    host: Settings.String({ default: 'localhost' }),
    port: Settings.Number({ default: 5432 }),
    user: Settings.String({ default: 'postgres' }),
    password: Settings.Optional(Settings.String()),
    database: Settings.String({ default: 'myapp' }),
    ssl: Settings.Boolean({ default: false })
  },
  {
    url: cfg => {
      const auth = cfg.password ? `${cfg.user}:${cfg.password}@` : `${cfg.user}@`;
      const sslParam = cfg.ssl ? '?sslmode=require' : '';
      return `postgresql://${auth}${cfg.host}:${cfg.port}/${cfg.database}${sslParam}`;
    },
    isSecure: cfg => cfg.ssl
  }
);

// Export the type for consumers
export type DatabaseConfigType = typeof DatabaseConfig._type;
```

**Key Benefits:**

- **Single function** - No separate `createSchemaWithComputed()`
- **Clean API** - `Settings(props, computed)` is intuitive
- **Automatic nesting** - Nested bundles bring their computed properties automatically
- **Full type inference** - TypeScript knows about computed properties

### Automatic Nested Computed Properties

When you nest a `Settings()` bundle in another config, its computed properties are automatically scoped:

```typescript
// App composes library configs
const AppConfig = Settings(
  {
    environment: Settings.String({ default: 'development' }),
    database: DatabaseConfig, // Just pass the bundle!
    redis: RedisConfig // Same here
  },
  {
    isDev: cfg => cfg.environment === 'development'
  }
);

// Result:
// config.database.url     - from DatabaseConfig (auto-scoped!)
// config.redis.url        - from RedisConfig (auto-scoped!)
// config.isDev            - from app-level computed
```

Computed properties are:

- **Reactive**: Recalculate on every access
- **Serializable**: Included in JSON.stringify()
- **Read-only**: Implemented as getters

### Immutable Configuration

All configuration objects are deeply frozen after creation. Attempting to mutate a config value throws a `TypeError`:

```typescript
const config = await getConfig();
config.database.port = 9999; // TypeError: Cannot assign to read only property
```

This prevents accidental mutation of cached singletons and ensures configuration consistency throughout your application. The `DeepReadonly` type is applied to all return types for compile-time safety.

### Type Coercion

By default, string values from environment variables are automatically coerced to match your schema:

```typescript
// Environment: DATABASE__PORT=5432 (string)
// Schema: port: Settings.Number()
// Result: settings.database.port === 5432 (number)
```

Disable coercion for strict type checking:

```typescript
const settings = await createSettings(Schema, [...], {
  coerce: false, // Strict mode - no automatic conversion
});
```

### Custom Resolvers

Create custom resolvers for any configuration source:

```typescript
import { SettingsResolver } from 'tydantic-settings';
import { TObject } from 'typebox';

function fromJsonFile(filePath: string): SettingsResolver {
  return async (schema: TObject) => {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  };
}

function fromConsulKV(url: string, prefix: string): SettingsResolver {
  return async (schema: TObject) => {
    // Fetch from Consul Key-Value store
    const response = await fetch(`${url}/v1/kv/${prefix}?recurse`);
    const data = await response.json();
    // Transform and return configuration
    return transformConsulData(data);
  };
}

// Use custom resolvers
const settings = await createSettings(Schema, [
  fromEnvironment(),
  fromConsulKV('http://consul:8500', 'myapp'),
  fromJsonFile('./config.json')
]);
```

See the [examples/](examples/) directory for a complete custom resolver implementation.

## API Reference

### `Settings(properties, computed?)` ⭐ Recommended

Creates a TypeBox schema with optional computed properties.

**Parameters:**

- `properties: Record<string, TSchema | SchemaWithComputed>` - Schema properties (can include nested bundles)
- `computed?: Record<string, (cfg) => any>` - Optional computed property functions

**Returns:**

- Without computed: `TObject` (plain TypeBox schema)
- With computed: `SchemaWithComputed<TObject, TComputed>` (bundle with schema + computed)

**Example:**

```typescript
// Without computed - returns plain schema
const SimpleConfig = Settings({
  host: Settings.String({ default: 'localhost' })
});

// With computed - returns bundle
const DatabaseConfig = Settings(
  { host: Settings.String(), port: Settings.Number() },
  { url: cfg => `postgresql://${cfg.host}:${cfg.port}` }
);

// Nesting - computed properties auto-scoped
const AppConfig = Settings(
  { database: DatabaseConfig },
  { isDev: cfg => cfg.environment === 'development' }
);
```

### `defineConfig(bundle, options)` ⭐ Recommended

Creates a singleton configuration factory with automatic schema/computed extraction.

**Parameters:**

- `bundle: SchemaWithComputed` - Configuration bundle created with `Settings()`
- `options: DefineConfigOptions` - Configuration options
  - `nestingSeparator?: string` - Separator for nested keys (e.g., `'__'`). **Inherited by resolvers.**
  - `resolvers: SettingsResolver[]` - Array of resolvers (required)

**Returns:** `{ getConfig: () => Promise<T>, resetConfig: () => void }`

**Example:**

```typescript
import {
  Settings,
  defineConfig,
  fromEnvironment,
  fromDotenv,
  type InferConfigType
} from 'tydantic-settings';

const AppConfig = Settings(
  { host: Settings.String({ default: 'localhost' }) },
  { url: cfg => `http://${cfg.host}` }
);

export type AppConfigType = InferConfigType<typeof AppConfig>;

// Resolvers inherit nestingSeparator automatically
export const { getConfig, resetConfig } = defineConfig(AppConfig, {
  nestingSeparator: '__',
  resolvers: [fromEnvironment(), fromDotenv()] // Both inherit '__'
});

// Usage
const config = await getConfig();
console.log(config.url); // http://localhost
```

### `defineConfigSync(bundle, options)`

Synchronous version of `defineConfig`. Use for CLI tools (Prisma migrations), class constructors, or other synchronous contexts.

**Parameters:**

- `bundle: SchemaWithComputed` - Configuration bundle created with `Settings()`
- `options: DefineConfigOptions<SyncSettingsResolver>` - Configuration options
  - `nestingSeparator?: string` - Separator for nested keys (e.g., `'__'`). **Inherited by resolvers.**
  - `resolvers: SyncSettingsResolver[]` - Array of sync resolvers (required)

**Returns:** `{ getConfig: () => T, resetConfig: () => void }`

**Example:**

```typescript
import { Settings, defineConfigSync, fromEnvironmentSync, fromDotenvSync } from 'tydantic-settings';

// Resolvers inherit nestingSeparator automatically
export const { getConfig, resetConfig } = defineConfigSync(AppConfig, {
  nestingSeparator: '__',
  resolvers: [fromEnvironmentSync(), fromDotenvSync()] // Both inherit '__'
});

// Usage (synchronous!)
const config = getConfig();
```

### `createSettings<T>(schema, resolvers, options?)`

Creates a validated, type-safe configuration object asynchronously.

**Parameters:**

- `schema: TObject` - TypeBox schema defining the configuration
- `resolvers: SettingsResolver[]` - Array of resolvers (highest priority first)
- `options?: object` - Configuration options
  - `nestingSeparator?: string` - Separator for nested keys (e.g., `'__'`)
  - `coerce?: boolean` - Enable type coercion (default: `true`)
  - `computed?: ComputedProperties` - Map of computed property functions

**Returns:** `Promise<Static<T>>` - Validated configuration object

**Example:**

```typescript
const settings = await createSettings(AppConfig.schema, [fromEnvironment(), fromDotenv()], {
  nestingSeparator: '__',
  computed: AppConfig.computed
});
```

### `createSyncSettings<T>(schema, resolvers, options?)`

Synchronous version of `createSettings`. Use for Prisma CLI, class constructors, or other synchronous contexts.

**Parameters:** Same as `createSettings`

**Returns:** `Static<T>` - Validated configuration object (synchronous)

**Example:**

```typescript
const config = createSyncSettings(
  DatabaseConfig.schema,
  [fromEnvironmentSync({ nestingSeparator: '__' })],
  { computed: DatabaseConfig.computed }
);
```

### Built-in Types

All TypeBox types are available via `Settings`:

```typescript
Settings.String(options?)
Settings.Number(options?)
Settings.Boolean(options?)
Settings.Enum(values, options?)
Settings.Optional(schema)
Settings.Array(schema, options?)
Settings.Union([schema1, schema2, ...])
Settings.Object(properties, options?)
Settings.Literal(value)
// ... and all other TypeBox types
```

## TypeScript Support

Full TypeScript support with static type inference, including computed properties:

```typescript
import { Settings, defineConfig, type InferConfigType } from 'tydantic-settings';

const AppConfig = Settings(
  {
    database: Settings(
      {
        host: Settings.String(),
        port: Settings.Number({ default: 5432 }),
      },
      {
        url: cfg => `postgresql://${cfg.host}:${cfg.port}`
      }
    ),
  },
  {
    isDev: cfg => cfg.database.host === 'localhost'
  }
);

// InferConfigType extracts the full type including computed properties
export type AppConfigType = InferConfigType<typeof AppConfig>;
// {
//   database: {
//     host: string;
//     port: number;
//     url: string;       // ← computed property included
//   };
//   isDev: boolean;      // ← computed property included
// }

const { getConfig } = defineConfig(AppConfig, {
  nestingSeparator: '__',
  resolvers: [fromEnvironment(), fromDotenv()]
});

const settings = await getConfig();
// settings is fully typed as AppConfigType
```

## Error Handling

Tydantic Settings provides clear error messages for configuration issues:

```typescript
// Missing required field
// Error: ❌ Invalid application configuration:
//   - Required property (at path: "/database/host")

// Type mismatch (with coerce: false)
// Error: ❌ Invalid application configuration:
//   - Expected number (at path: "/database/port")

// Invalid computed property path
// Error: Cannot add computed property "NonExistent.field":
//        parent object "NonExistent" does not exist
```

## Best Practices

1. **Define your schema first** - Use TypeBox schema as the single source of truth
2. **Use environment variables for secrets** - Never commit secrets to `.env` files
3. **Order resolvers by priority** - Put most specific sources first
4. **Use computed properties for derived data** - Connection URLs, environment flags, etc.
5. **Validate early** - Call `getConfig()` at application startup
6. **Export typed settings** - Use `InferConfigType<typeof AppConfig>` for type inference

## Examples

The [examples/](examples/) directory contains runnable examples covering basic configuration, multi-environment setups, AWS Secrets Manager, custom resolvers, computed properties, and more. See the [examples README](examples/README.md) for a full listing.

## Comparison with Pydantic Settings

If you're familiar with Python's Pydantic Settings:

| Pydantic Settings            | Tydantic Settings                         |
| ---------------------------- | ----------------------------------------- |
| `BaseSettings`               | `Settings()`                              |
| `Field(default=...)`         | `Settings.String({ default: ... })`       |
| `@computed_field`            | `computed: { 'field': (cfg) => ... }`     |
| `model_config['env_prefix']` | `nestingSeparator` option                 |
| `.env` file support          | `fromDotenv()` resolver                   |
| Custom sources               | Custom resolvers                          |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Related Projects

- [TypeBox](https://github.com/sinclairzx81/typebox) - JSON Schema Type Builder
- [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) - Python configuration management
- [dotenv](https://github.com/motdotla/dotenv) - `.env` file support

## Support

- 📖 [Documentation](examples/)
- 🐛 [Issue Tracker](https://github.com/mlovretovich/tydantic-settings/issues)
