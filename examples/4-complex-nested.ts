import { Settings, createSettings, fromEnvironment, fromDotenv } from '../src';

/**
 * Complex Nested Configuration Example
 *
 * This example demonstrates deeply nested configuration structures:
 * - Multiple levels of nesting
 * - Arrays and complex types
 * - Optional and required fields
 * - Using nestingSeparator for flat environment variable mapping
 */

const ComplexConfigSchema = Settings({
  app: Settings({
    name: Settings.String({ default: 'MyComplexApp' }),
    version: Settings.String({ default: '1.0.0' }),
    debug: Settings.Boolean({ default: false })
  }),
  services: Settings({
    database: Settings({
      primary: Settings({
        host: Settings.String(),
        port: Settings.Number({ default: 5432 }),
        connectionPool: Settings({
          min: Settings.Number({ default: 2 }),
          max: Settings.Number({ default: 10 }),
          idleTimeout: Settings.Number({ default: 30000 })
        })
      }),
      replica: Settings.Optional(
        Settings.Object({
          host: Settings.String(),
          port: Settings.Number({ default: 5432 })
        })
      )
    }),
    cache: Settings({
      redis: Settings({
        host: Settings.String({ default: 'localhost' }),
        port: Settings.Number({ default: 6379 }),
        ttl: Settings.Number({ default: 3600 }),
        cluster: Settings({
          enabled: Settings.Boolean({ default: false }),
          nodes: Settings.Optional(Settings.Number({ default: 3 }))
        })
      })
    }),
    messageQueue: Settings({
      type: Settings.Enum(
        { RabbitMQ: 'rabbitmq', SQS: 'sqs', Kafka: 'kafka' },
        { default: 'rabbitmq' }
      ),
      host: Settings.String({ default: 'localhost' }),
      port: Settings.Number({ default: 5672 }),
      retryPolicy: Settings({
        maxRetries: Settings.Number({ default: 3 }),
        backoffMs: Settings.Number({ default: 1000 })
      })
    })
  }),
  security: Settings({
    jwt: Settings({
      secret: Settings.String(),
      expiresIn: Settings.String({ default: '1h' }),
      refreshToken: Settings({
        enabled: Settings.Boolean({ default: true }),
        expiresIn: Settings.String({ default: '7d' })
      })
    }),
    rateLimit: Settings({
      enabled: Settings.Boolean({ default: true }),
      windowMs: Settings.Number({ default: 60000 }),
      maxRequests: Settings.Number({ default: 100 })
    })
  }),
  observability: Settings({
    metrics: Settings({
      enabled: Settings.Boolean({ default: false }),
      port: Settings.Number({ default: 9090 })
    }),
    tracing: Settings({
      enabled: Settings.Boolean({ default: false }),
      endpoint: Settings.Optional(Settings.String()),
      sampleRate: Settings.Number({ default: 0.1 })
    })
  })
});

const separator = '__';
const settings = await createSettings(
  ComplexConfigSchema,
  [fromEnvironment({ nestingSeparator: separator }), fromDotenv({ nestingSeparator: separator })],
  { nestingSeparator: separator }
);

console.log('Complex Nested Configuration:', JSON.stringify(settings, null, 2));

// Example environment variables for this complex config:
// APP__NAME=MyComplexApp
// APP__VERSION=2.0.0
// APP__DEBUG=true
//
// SERVICES__DATABASE__PRIMARY__HOST=postgres.example.com
// SERVICES__DATABASE__PRIMARY__PORT=5432
// SERVICES__DATABASE__PRIMARY__CONNECTION_POOL__MIN=5
// SERVICES__DATABASE__PRIMARY__CONNECTION_POOL__MAX=20
//
// SERVICES__DATABASE__REPLICA__HOST=postgres-replica.example.com
// SERVICES__DATABASE__REPLICA__PORT=5432
//
// SERVICES__CACHE__REDIS__HOST=redis.example.com
// SERVICES__CACHE__REDIS__PORT=6379
// SERVICES__CACHE__REDIS__TTL=7200
// SERVICES__CACHE__REDIS__CLUSTER__ENABLED=true
// SERVICES__CACHE__REDIS__CLUSTER__NODES=5
//
// SERVICES__MESSAGE_QUEUE__TYPE=kafka
// SERVICES__MESSAGE_QUEUE__HOST=kafka.example.com
// SERVICES__MESSAGE_QUEUE__PORT=9092
// SERVICES__MESSAGE_QUEUE__RETRY_POLICY__MAX_RETRIES=5
// SERVICES__MESSAGE_QUEUE__RETRY_POLICY__BACKOFF_MS=2000
//
// SECURITY__JWT__SECRET=your-super-secret-key
// SECURITY__JWT__EXPIRES_IN=2h
// SECURITY__JWT__REFRESH_TOKEN__ENABLED=true
// SECURITY__JWT__REFRESH_TOKEN__EXPIRES_IN=30d
//
// SECURITY__RATE_LIMIT__ENABLED=true
// SECURITY__RATE_LIMIT__WINDOW_MS=60000
// SECURITY__RATE_LIMIT__MAX_REQUESTS=1000
//
// OBSERVABILITY__METRICS__ENABLED=true
// OBSERVABILITY__METRICS__PORT=9090
// OBSERVABILITY__TRACING__ENABLED=true
// OBSERVABILITY__TRACING__ENDPOINT=http://jaeger:14268/api/traces
// OBSERVABILITY__TRACING__SAMPLE_RATE=0.5

export default settings;
