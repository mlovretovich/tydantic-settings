import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSettings,
  createSyncSettings,
  Settings,
  defineConfig,
  defineConfigSync,
} from './settings';
import { isSchemaWithComputed } from './core/nested-bundles';
import { SyncSettingsResolver } from './types';
import { fromEnvironment, fromEnvironmentSync } from './resolvers';
import { Type } from '@sinclair/typebox';

// ============================================================================
// createSettings (Async)
// ============================================================================

describe('createSettings', () => {
  const Schema = Settings({
    env: Settings.Enum({ Dev: 'dev', Prod: 'prod' }, { default: 'dev' }),
    database: Settings({
      host: Settings.String(),
      port: Settings.Number({ default: 5432 }),
    }),
    apiKey: Settings.Optional(Settings.String()),
  });

  it('should merge settings from multiple resolvers with correct priority', async () => {
    const highPriorityResolver = vi.fn().mockResolvedValue({
      DATABASE__HOST: 'prod.db',
      API_KEY: 'from-high-priority',
    });
    const lowPriorityResolver = vi.fn().mockResolvedValue({
      DATABASE__HOST: 'dev.db',
      DATABASE__PORT: '1234',
    });

    const settings = await createSettings(Schema, [highPriorityResolver, lowPriorityResolver], {
      nestingSeparator: '__',
    });

    expect(settings).toEqual({
      env: 'dev', // from default
      database: {
        host: 'prod.db', // from high priority
        port: 1234, // from low priority, coerced to number
      },
      apiKey: 'from-high-priority', // from high priority
    });
  });

  it('should correctly coerce types', async () => {
    const resolver = vi.fn().mockResolvedValue({
      DATABASE__HOST: 'localhost',
      DATABASE__PORT: '8888', // string to be coerced to number
    });

    const settings = await createSettings(Schema, [resolver], {
      nestingSeparator: '__',
    });

    expect(typeof settings.database.port).toBe('number');
    expect(settings.database.port).toBe(8888);
  });

  it('should throw an error for missing required fields', async () => {
    const resolver = vi.fn().mockResolvedValue({
      DATABASE__PORT: '1234',
    });

    await expect(createSettings(Schema, [resolver], { nestingSeparator: '__' })).rejects.toThrow(
      /database.host/
    );
  });

  it('should handle case-insensitivity and different separators', async () => {
    const resolver = vi.fn().mockResolvedValue({
      'database-host': 'localhost',
      'DATABASE-PORT': '9999',
    });

    const settings = await createSettings(Schema, [resolver], {
      nestingSeparator: '-',
    });

    expect(settings.database.host).toBe('localhost');
    expect(settings.database.port).toBe(9999);
  });

  it('should use default values when no value is provided', async () => {
    const resolver = vi.fn().mockResolvedValue({
      DATABASE__HOST: 'localhost',
    });

    const settings = await createSettings(Schema, [resolver], {
      nestingSeparator: '__',
    });

    expect(settings.env).toBe('dev');
    expect(settings.database.port).toBe(5432);
  });

  it('should handle empty resolvers array', async () => {
    await expect(createSettings(Schema, [])).rejects.toThrow();

    const AllOptionalSchema = Settings({
      env: Settings.Enum({ Dev: 'dev' }, { default: 'dev' }),
      port: Settings.Optional(Settings.Number()),
    });
    const settings = await createSettings(AllOptionalSchema, []);
    expect(settings).toEqual({ env: 'dev' });
  });

  it('should not perform coercion when disabled', async () => {
    const resolver = vi.fn().mockResolvedValue({
      DATABASE__HOST: 'localhost',
      DATABASE__PORT: '8888',
    });

    await expect(
      createSettings(Schema, [resolver], {
        nestingSeparator: '__',
        coerce: false,
      })
    ).rejects.toThrow(/Expected number/);
  });

  it('should add computed properties to the config', async () => {
    const SchemaWithComputed = Settings({
      env: Settings.Enum({ Dev: 'dev', Prod: 'prod' }, { default: 'dev' }),
      database: Settings(
        {
          host: Settings.String(),
          port: Settings.Number({ default: 5432 }),
        },
        {
          url: cfg => `postgres://${cfg.host}:${cfg.port}`,
        }
      ),
      apiKey: Settings.Optional(Settings.String()),
    });

    const resolver = vi.fn().mockResolvedValue({
      DATABASE__HOST: 'localhost',
      DATABASE__PORT: '5432',
    });

    const settings = await createSettings(SchemaWithComputed, [resolver], {
      nestingSeparator: '__',
    });

    expect((settings.database as any).url).toBe('postgres://localhost:5432');
  });

  it('should return a deeply frozen config object', async () => {
    const resolver = vi.fn().mockResolvedValue({
      DATABASE__HOST: 'localhost',
      DATABASE__PORT: '5432',
    });

    const settings = await createSettings(Schema, [resolver], {
      nestingSeparator: '__',
    });

    expect(Object.isFrozen(settings)).toBe(true);
    expect(Object.isFrozen(settings.database)).toBe(true);
    expect(() => {
      (settings as any).env = 'prod';
    }).toThrow(TypeError);
    expect(() => {
      (settings as any).database.port = 9999;
    }).toThrow(TypeError);
  });

  it('should throw error when computed property parent does not exist', async () => {
    const resolver = vi.fn().mockResolvedValue({
      DATABASE__HOST: 'localhost',
      DATABASE__PORT: '5432',
    });

    await expect(
      createSettings(Schema.schema, [resolver], {
        nestingSeparator: '__',
        computed: {
          'nonexistent.property': () => 'value',
        },
      })
    ).rejects.toThrow(/Cannot add computed property.*parent object.*does not exist/);
  });
});

// ============================================================================
// createSyncSettings
// ============================================================================

describe('createSyncSettings', () => {
  const Schema = Settings({
    env: Settings.Enum({ Dev: 'dev', Prod: 'prod' }, { default: 'dev' }),
    database: Settings({
      host: Settings.String(),
      port: Settings.Number({ default: 5432 }),
    }),
    apiKey: Settings.Optional(Settings.String()),
  });

  it('should merge settings from multiple resolvers with correct priority', () => {
    const highPriorityResolver: SyncSettingsResolver = vi.fn().mockReturnValue({
      DATABASE__HOST: 'prod.db',
      API_KEY: 'from-high-priority',
    });
    const lowPriorityResolver: SyncSettingsResolver = vi.fn().mockReturnValue({
      DATABASE__HOST: 'dev.db',
      DATABASE__PORT: '1234',
    });

    const settings = createSyncSettings(Schema, [highPriorityResolver, lowPriorityResolver], {
      nestingSeparator: '__',
    });

    expect(settings).toEqual({
      env: 'dev',
      database: {
        host: 'prod.db',
        port: 1234,
      },
      apiKey: 'from-high-priority',
    });
  });

  it('should correctly coerce types', () => {
    const resolver: SyncSettingsResolver = vi.fn().mockReturnValue({
      DATABASE__HOST: 'localhost',
      DATABASE__PORT: '8888',
    });

    const settings = createSyncSettings(Schema, [resolver], {
      nestingSeparator: '__',
    });

    expect(typeof settings.database.port).toBe('number');
    expect(settings.database.port).toBe(8888);
  });

  it('should throw an error for missing required fields', () => {
    const resolver: SyncSettingsResolver = vi.fn().mockReturnValue({
      DATABASE__PORT: '1234',
    });

    expect(() => createSyncSettings(Schema, [resolver], { nestingSeparator: '__' })).toThrow(
      /database.host/
    );
  });

  it('should add computed properties to the config', () => {
    const SchemaWithComputed = Settings({
      env: Settings.Enum({ Dev: 'dev', Prod: 'prod' }, { default: 'dev' }),
      database: Settings(
        {
          host: Settings.String(),
          port: Settings.Number({ default: 5432 }),
        },
        {
          url: cfg => `postgres://${cfg.host}:${cfg.port}`,
        }
      ),
      apiKey: Settings.Optional(Settings.String()),
    });

    const resolver: SyncSettingsResolver = vi.fn().mockReturnValue({
      DATABASE__HOST: 'localhost',
      DATABASE__PORT: '5432',
    });

    const settings = createSyncSettings(SchemaWithComputed, [resolver], {
      nestingSeparator: '__',
    });

    expect((settings.database as any).url).toBe('postgres://localhost:5432');
  });

  describe('environment resolver', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {};
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should support environment variable resolver', () => {
      process.env.DATABASE__HOST = 'env-host';
      process.env.DATABASE__PORT = '9999';

      const settings = createSyncSettings(
        Schema,
        [fromEnvironmentSync({ nestingSeparator: '__' })],
        { nestingSeparator: '__' }
      );

      expect(settings.database.host).toBe('env-host');
      expect(settings.database.port).toBe(9999);
    });
  });
});

// ============================================================================
// Settings() Unified API
// ============================================================================

describe('Settings', () => {
  describe('without computed properties', () => {
    it('should create a SchemaWithComputed bundle with empty computed', () => {
      const bundle = Settings({
        host: Settings.String({ default: 'localhost' }),
        port: Settings.Number({ default: 3000 }),
      });

      expect(isSchemaWithComputed(bundle)).toBe(true);
      expect(bundle).toHaveProperty('schema');
      expect(bundle).toHaveProperty('computed');
      expect(bundle.schema).toHaveProperty('properties');
      expect(Object.keys(bundle.computed)).toHaveLength(0);
    });

    it('should work with createSyncSettings', () => {
      const bundle = Settings({
        host: Settings.String({ default: 'localhost' }),
        port: Settings.Number({ default: 3000 }),
      });

      const config = createSyncSettings(bundle.schema, []);

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(3000);
    });
  });

  describe('with computed properties', () => {
    it('should return a SchemaWithComputed bundle', () => {
      const bundle = Settings(
        {
          host: Settings.String({ default: 'localhost' }),
          port: Settings.Number({ default: 3000 }),
        },
        {
          url: cfg => `http://${cfg.host}:${cfg.port}`,
        }
      );

      expect(isSchemaWithComputed(bundle)).toBe(true);
      expect(bundle.computed.url).toBeTypeOf('function');
    });

    it('should work with createSyncSettings and computed', () => {
      const bundle = Settings(
        {
          host: Settings.String({ default: 'localhost' }),
          port: Settings.Number({ default: 3000 }),
        },
        {
          url: cfg => `http://${cfg.host}:${cfg.port}`,
        }
      );

      const config = createSyncSettings(bundle.schema, [], {
        computed: bundle.computed,
      });

      expect(config.host).toBe('localhost');
      expect((config as any).url).toBe('http://localhost:3000');
    });
  });

  describe('nested SchemaWithComputed bundles', () => {
    it('should auto-detect and extract nested bundles', () => {
      const DatabaseConfig = Settings(
        {
          host: Settings.String({ default: 'localhost' }),
          port: Settings.Number({ default: 5432 }),
        },
        {
          url: cfg => `postgresql://${cfg.host}:${cfg.port}`,
        }
      );

      const AppConfig = Settings(
        {
          environment: Settings.String({ default: 'development' }),
          database: DatabaseConfig,
        },
        {
          isDev: cfg => cfg.environment === 'development',
        }
      );

      expect(isSchemaWithComputed(AppConfig)).toBe(true);
      expect(AppConfig.schema.properties.database).toBeDefined();
      expect(isSchemaWithComputed(AppConfig.schema.properties.database)).toBe(false);
    });

    it('should scope nested computed properties', () => {
      const DatabaseConfig = Settings(
        {
          host: Settings.String({ default: 'localhost' }),
          port: Settings.Number({ default: 5432 }),
        },
        {
          url: cfg => `postgresql://${cfg.host}:${cfg.port}`,
        }
      );

      const AppConfig = Settings(
        {
          environment: Settings.String({ default: 'development' }),
          database: DatabaseConfig,
        },
        {
          isDev: cfg => cfg.environment === 'development',
        }
      );

      const config = createSyncSettings(AppConfig.schema, [], {
        computed: AppConfig.computed,
      });

      expect((config as any).isDev).toBe(true);
      expect((config.database as any).url).toBe('postgresql://localhost:5432');
    });

    it('should merge deeply nested bundles', () => {
      const InnerConfig = Settings(
        { value: Settings.String({ default: 'inner' }) },
        { computed: cfg => `computed:${cfg.value}` }
      );

      const MiddleConfig = Settings(
        {
          name: Settings.String({ default: 'middle' }),
          inner: InnerConfig,
        },
        { fullName: cfg => `${cfg.name}/${cfg.inner.value}` }
      );

      const OuterConfig = Settings(
        {
          id: Settings.String({ default: 'outer' }),
          middle: MiddleConfig,
        },
        { summary: cfg => `${cfg.id}:${cfg.middle.name}` }
      );

      const config = createSyncSettings(OuterConfig.schema, [], {
        computed: OuterConfig.computed,
      });

      expect(config.id).toBe('outer');
      expect(config.middle.name).toBe('middle');
      expect(config.middle.inner.value).toBe('inner');
      expect((config as any).summary).toBe('outer:middle');
      expect((config.middle as any).fullName).toBe('middle/inner');
      expect((config.middle.inner as any).computed).toBe('computed:inner');
    });
  });

  describe('static type helpers', () => {
    it('should have String helper', () => {
      expect(Settings.String).toBeDefined();
      const schema = Settings.String({ default: 'test' });
      expect(schema.type).toBe('string');
    });

    it('should have Number helper', () => {
      expect(Settings.Number).toBeDefined();
      const schema = Settings.Number({ default: 42 });
      expect(schema.type).toBe('number');
    });

    it('should have Boolean helper', () => {
      expect(Settings.Boolean).toBeDefined();
      const schema = Settings.Boolean({ default: true });
      expect(schema.type).toBe('boolean');
    });
  });
});

describe('isSchemaWithComputed', () => {
  it('should return true for SchemaWithComputed bundles', () => {
    const bundle = Settings({ value: Settings.String() }, { computed: cfg => cfg.value });
    expect(isSchemaWithComputed(bundle)).toBe(true);
  });

  it('should return false for plain TypeBox schemas', () => {
    const schema = Type.Object({ value: Type.String() });
    expect(isSchemaWithComputed(schema)).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isSchemaWithComputed(null)).toBe(false);
    expect(isSchemaWithComputed(undefined)).toBe(false);
  });
});

// ============================================================================
// defineConfig (Async Singleton)
// ============================================================================

describe('defineConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const TestConfig = Settings({
    host: Settings.String({ default: 'localhost' }),
    port: Settings.Number({ default: 3000 }),
  });

  const TestConfigWithComputed = Settings(
    {
      host: Settings.String({ default: 'localhost' }),
      port: Settings.Number({ default: 3000 }),
    },
    {
      url: cfg => `http://${cfg.host}:${cfg.port}`,
    }
  );

  it('should return getConfig and resetConfig functions', () => {
    const { getConfig, resetConfig } = defineConfig(TestConfig, {
      nestingSeparator: '__',
      resolvers: [fromEnvironment()],
    });

    expect(typeof getConfig).toBe('function');
    expect(typeof resetConfig).toBe('function');
  });

  it('should cache config after first call (singleton)', async () => {
    const { getConfig } = defineConfig(TestConfig, {
      nestingSeparator: '__',
      resolvers: [fromEnvironment()],
    });

    const config1 = await getConfig();
    const config2 = await getConfig();

    expect(config1).toBe(config2); // Same reference
  });

  it('should clear cache when resetConfig is called', async () => {
    const { getConfig, resetConfig } = defineConfig(TestConfig, {
      nestingSeparator: '__',
      resolvers: [fromEnvironment()],
    });

    const config1 = await getConfig();
    resetConfig();
    const config2 = await getConfig();

    expect(config1).not.toBe(config2); // Different reference
  });

  it('should load config from environment using provided resolvers', async () => {
    process.env.HOST = 'from-env';
    process.env.PORT = '8080';

    const { getConfig } = defineConfig(TestConfig, {
      nestingSeparator: '__',
      resolvers: [fromEnvironment()],
    });
    const config = await getConfig();

    expect(config.host).toBe('from-env');
    expect(config.port).toBe(8080);
  });

  it('should extract schema and computed from bundle automatically', async () => {
    const { getConfig } = defineConfig(TestConfigWithComputed, {
      nestingSeparator: '__',
      resolvers: [fromEnvironment()],
    });

    const config = await getConfig();

    expect((config as any).url).toBe('http://localhost:3000');
  });

  it('should use custom resolvers passed via options.resolvers', async () => {
    const customResolver = vi.fn().mockResolvedValue({
      HOST: 'custom-host',
      PORT: '9999',
    });

    const { getConfig } = defineConfig(TestConfig, {
      nestingSeparator: '__',
      resolvers: [customResolver],
    });

    const config = await getConfig();

    expect(customResolver).toHaveBeenCalled();
    expect(config.host).toBe('custom-host');
    expect(config.port).toBe(9999);
  });

  it('should support nested config with nestingSeparator', async () => {
    process.env.DATABASE__HOST = 'nested-host';

    const NestedConfig = Settings({
      database: Settings({
        host: Settings.String({ default: 'localhost' }),
      }),
    });

    const { getConfig } = defineConfig(NestedConfig, {
      nestingSeparator: '__',
      resolvers: [fromEnvironment({ nestingSeparator: '__' })],
    });
    const config = await getConfig();

    expect(config.database.host).toBe('nested-host');
  });

  it('should inherit nestingSeparator from defineConfig when not specified in resolver', async () => {
    process.env.DATABASE__PORT = '5432';

    const NestedConfig = Settings({
      database: Settings({
        port: Settings.Number({ default: 3306 }),
      }),
    });

    // Resolver doesn't specify separator - should inherit from defineConfig
    const { getConfig } = defineConfig(NestedConfig, {
      nestingSeparator: '__',
      resolvers: [fromEnvironment()], // No separator specified here!
    });
    const config = await getConfig();

    expect(config.database.port).toBe(5432);
  });

  it('should allow resolver to override inherited nestingSeparator', async () => {
    // Clean slate - remove any conflicting env vars
    delete process.env.DATABASE__HOST;
    delete process.env.DATABASE__PORT;
    process.env['DATABASE--HOST'] = 'double-dash-host';

    const NestedConfig = Settings({
      database: Settings({
        host: Settings.String({ default: 'localhost' }),
      }),
    });

    // Resolver explicitly specifies different separator - overrides the defineConfig separator
    const { getConfig } = defineConfig(NestedConfig, {
      nestingSeparator: '--', // Use -- for unflattening
      resolvers: [fromEnvironment({ nestingSeparator: '--' })], // Use -- for env var lookup
    });
    const config = await getConfig();

    expect(config.database.host).toBe('double-dash-host');
  });
});

// ============================================================================
// defineConfigSync (Sync Singleton)
// ============================================================================

describe('defineConfigSync', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const TestConfig = Settings({
    host: Settings.String({ default: 'localhost' }),
    port: Settings.Number({ default: 3000 }),
  });

  const TestConfigWithComputed = Settings(
    {
      host: Settings.String({ default: 'localhost' }),
      port: Settings.Number({ default: 3000 }),
    },
    {
      url: cfg => `http://${cfg.host}:${cfg.port}`,
    }
  );

  it('should return sync getConfig function', () => {
    const { getConfig } = defineConfigSync(TestConfig, {
      nestingSeparator: '__',
      resolvers: [fromEnvironmentSync()],
    });

    const config = getConfig(); // No await needed
    expect(config).toBeDefined();
    expect(config.host).toBe('localhost');
  });

  it('should cache config after first call (singleton)', () => {
    const { getConfig } = defineConfigSync(TestConfig, {
      nestingSeparator: '__',
      resolvers: [fromEnvironmentSync()],
    });

    const config1 = getConfig();
    const config2 = getConfig();

    expect(config1).toBe(config2); // Same reference
  });

  it('should clear cache when resetConfig is called', () => {
    const { getConfig, resetConfig } = defineConfigSync(TestConfig, {
      nestingSeparator: '__',
      resolvers: [fromEnvironmentSync()],
    });

    const config1 = getConfig();
    resetConfig();
    const config2 = getConfig();

    expect(config1).not.toBe(config2); // Different reference
  });

  it('should load config from environment using provided resolvers', () => {
    process.env.HOST = 'sync-host';
    process.env.PORT = '7777';

    const { getConfig } = defineConfigSync(TestConfig, {
      nestingSeparator: '__',
      resolvers: [fromEnvironmentSync()],
    });
    const config = getConfig();

    expect(config.host).toBe('sync-host');
    expect(config.port).toBe(7777);
  });

  it('should extract schema and computed from bundle automatically', () => {
    const { getConfig } = defineConfigSync(TestConfigWithComputed, {
      nestingSeparator: '__',
      resolvers: [fromEnvironmentSync()],
    });

    const config = getConfig();

    expect((config as any).url).toBe('http://localhost:3000');
  });

  it('should use custom sync resolvers passed via options.resolvers', () => {
    const customResolver: SyncSettingsResolver = vi.fn().mockReturnValue({
      HOST: 'custom-sync-host',
      PORT: '6666',
    });

    const { getConfig } = defineConfigSync(TestConfig, {
      nestingSeparator: '__',
      resolvers: [customResolver],
    });

    const config = getConfig();

    expect(customResolver).toHaveBeenCalled();
    expect(config.host).toBe('custom-sync-host');
    expect(config.port).toBe(6666);
  });
});

// ============================================================================
// createSettings with SchemaWithComputed bundle
// ============================================================================

describe('createSettings with bundle', () => {
  const ConfigBundle = Settings(
    {
      host: Settings.String({ default: 'localhost' }),
      port: Settings.Number({ default: 5432 }),
    },
    {
      url: cfg => `postgresql://${cfg.host}:${cfg.port}`,
    }
  );

  it('should accept SchemaWithComputed bundle directly', async () => {
    const resolver = vi.fn().mockResolvedValue({});

    const config = await createSettings(ConfigBundle, [resolver], {
      nestingSeparator: '__',
    });

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(5432);
  });

  it('should auto-extract computed from bundle', async () => {
    const resolver = vi.fn().mockResolvedValue({});

    const config = await createSettings(ConfigBundle, [resolver], {
      nestingSeparator: '__',
    });

    // Computed property should be available without passing options.computed
    expect((config as any).url).toBe('postgresql://localhost:5432');
  });

  it('should work with nested bundles', async () => {
    const DatabaseConfig = Settings(
      {
        host: Settings.String({ default: 'db-host' }),
        port: Settings.Number({ default: 5432 }),
      },
      {
        connectionString: cfg => `postgres://${cfg.host}:${cfg.port}`,
      }
    );

    const AppBundle = Settings(
      {
        environment: Settings.String({ default: 'development' }),
        database: DatabaseConfig,
      },
      {
        isDev: cfg => cfg.environment === 'development',
      }
    );

    const resolver = vi.fn().mockResolvedValue({});

    const config = await createSettings(AppBundle, [resolver], {
      nestingSeparator: '__',
    });

    expect(config.environment).toBe('development');
    expect(config.database.host).toBe('db-host');
    expect((config as any).isDev).toBe(true);
    expect((config.database as any).connectionString).toBe('postgres://db-host:5432');
  });
});

describe('createSyncSettings with bundle', () => {
  const ConfigBundle = Settings(
    {
      host: Settings.String({ default: 'localhost' }),
      port: Settings.Number({ default: 5432 }),
    },
    {
      url: cfg => `postgresql://${cfg.host}:${cfg.port}`,
    }
  );

  it('should accept SchemaWithComputed bundle directly', () => {
    const resolver: SyncSettingsResolver = vi.fn().mockReturnValue({});

    const config = createSyncSettings(ConfigBundle, [resolver], {
      nestingSeparator: '__',
    });

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(5432);
  });

  it('should auto-extract computed from bundle', () => {
    const resolver: SyncSettingsResolver = vi.fn().mockReturnValue({});

    const config = createSyncSettings(ConfigBundle, [resolver], {
      nestingSeparator: '__',
    });

    expect((config as any).url).toBe('postgresql://localhost:5432');
  });
});
