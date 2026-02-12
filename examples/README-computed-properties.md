# Computed Properties Guide

Computed properties allow you to add derived/calculated fields to your configuration, similar to Pydantic's `@computed_field` decorator.

## Features

- **Reactive**: Computed properties recalculate on every access
- **Type-safe**: Full TypeScript support via `InferConfigType`
- **Serializable**: Included in JSON.stringify output
- **Read-only**: Implemented as getters (cannot be overwritten)
- **Post-validation**: Added after schema validation completes
- **Auto-scoped**: Nested bundles bring their computed properties automatically

## Basic Usage

```typescript
import { Settings, defineConfig, fromEnvironment, type InferConfigType } from 'tydantic-settings';

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

export type DatabaseConfigType = InferConfigType<typeof DatabaseConfig>;

const { getConfig } = defineConfig(DatabaseConfig, {
  nestingSeparator: '__',
  resolvers: [fromEnvironment()]
});

const config = await getConfig();
console.log(config.url);
// Output: postgresql://admin:secret@localhost:5432
```

## Composing Configs with Computed Properties

When you nest a `Settings()` bundle in another config, its computed properties are automatically scoped:

```typescript
const AppConfig = Settings(
  {
    environment: Settings.Enum(
      { Development: 'development', Production: 'production', Test: 'test' },
      { default: 'development' }
    ),
    database: DatabaseConfig,   // Nested bundle — computed props auto-scoped!
    redis: RedisConfig          // Same here
  },
  {
    isProduction: cfg => cfg.environment === 'production',
    isDevelopment: cfg => cfg.environment === 'development'
  }
);

export type AppConfigType = InferConfigType<typeof AppConfig>;

const { getConfig } = defineConfig(AppConfig, {
  nestingSeparator: '__',
  resolvers: [fromEnvironment(), fromDotenv()]
});

const config = await getConfig();

// Computed properties are scoped to their parent
config.database.url;      // From DatabaseConfig
config.redis.url;         // From RedisConfig
config.isProduction;      // From AppConfig
config.isDevelopment;     // From AppConfig
```

## Common Patterns

### Connection URLs

```typescript
const DatabaseConfig = Settings(
  {
    host: Settings.String(),
    port: Settings.Number({ default: 5432 }),
    user: Settings.String(),
    password: Settings.String(),
    name: Settings.String({ default: 'myapp' })
  },
  {
    url: cfg =>
      `postgresql://${cfg.user}:${cfg.password}@${cfg.host}:${cfg.port}/${cfg.name}`
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
```

### API Base URLs

```typescript
const ApiConfig = Settings(
  {
    host: Settings.String({ default: 'localhost' }),
    port: Settings.Number({ default: 3000 }),
    https: Settings.Boolean({ default: false })
  },
  {
    baseUrl: cfg => {
      const protocol = cfg.https ? 'https' : 'http';
      const port =
        (cfg.https && cfg.port === 443) || (!cfg.https && cfg.port === 80)
          ? ''
          : `:${cfg.port}`;
      return `${protocol}://${cfg.host}${port}`;
    }
  }
);
```

### Environment Flags

```typescript
const AppConfig = Settings(
  {
    environment: Settings.Enum(
      { Development: 'development', Production: 'production', Test: 'test' },
      { default: 'development' }
    ),
    debug: Settings.Boolean({ default: false })
  },
  {
    isProduction: cfg => cfg.environment === 'production',
    isDevelopment: cfg => cfg.environment === 'development',
    isTest: cfg => cfg.environment === 'test',
    debugEnabled: cfg => cfg.environment !== 'production' && cfg.debug
  }
);
```

## Reactive Behavior

Computed properties recalculate on every access:

```typescript
const config = await getConfig();

console.log(config.database.url);
// postgresql://localhost:5432

config.database.port = 5433; // Change the port

console.log(config.database.url);
// postgresql://localhost:5433  ← Automatically updated!
```

## JSON Serialization

Computed properties are included in JSON output:

```typescript
const config = await getConfig();

console.log(JSON.stringify(config, null, 2));
// {
//   "database": {
//     "host": "localhost",
//     "port": 5432,
//     "user": "admin",
//     "password": "secret",
//     "url": "postgresql://admin:secret@localhost:5432"  ← Included!
//   }
// }
```

## Error Handling

If you try to add a computed property to a non-existent parent, you'll get a clear error:

```typescript
// Error: Cannot add computed property "nonExistent.property":
//        parent object "nonExistent" does not exist
```

## Best Practices

1. **Use for derived data**: Computed properties are perfect for values derived from other config values
2. **Keep them simple**: Complex computations should be done elsewhere
3. **Don't mutate**: Computed property functions should be pure (no side effects)
4. **Use `InferConfigType`**: For full type inference including computed properties
5. **Compose with bundles**: Define computed properties alongside their schema, then nest

## See Also

- [7-computed-properties.ts](./7-computed-properties.ts) - Comprehensive example
- [8-config-with-computed.ts](./8-config-with-computed.ts) - Real-world example
