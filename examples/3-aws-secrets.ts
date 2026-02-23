import { Settings, createSettings, fromEnvironment, fromDotenv, fromAwsSecretsManager } from '../src';

/**
 * AWS Secrets Manager Configuration Example
 *
 * This example demonstrates how to use AWS Secrets Manager for sensitive configuration:
 * - Database credentials stored in AWS Secrets Manager
 * - API keys from AWS Secrets
 * - Multiple secret sources
 * - Fallback to environment variables for local development
 *
 * Prerequisites:
 * - AWS credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * - Secrets created in AWS Secrets Manager
 */

const SecureConfigSchema = Settings({
  environment: Settings.Enum(
    { Development: 'development', Production: 'production' },
    { default: 'development' }
  ),
  database: Settings({
    host: Settings.String(),
    port: Settings.Number({ default: 5432 }),
    name: Settings.String(),
    user: Settings.String(),
    password: Settings.String() // This should come from secrets
  }),
  api: Settings({
    stripeKey: Settings.String(), // Sensitive API key
    sendGridKey: Settings.String() // Another sensitive key
  }),
  // Optional: AWS configuration for non-production environments
  awsSecretId: Settings.Optional(Settings.String()),
  awsRegion: Settings.Optional(Settings.String({ default: 'us-east-1' }))
});

// In production, use AWS Secrets Manager
// In development, fall back to environment variables or .env
const resolvers =
  process.env.ENVIRONMENT === 'production'
    ? [
        fromEnvironment({ nestingSeparator: '__' }),
        fromAwsSecretsManager(
          ['myapp/database', 'myapp/api-keys'], // Multiple secrets
          process.env.AWS_REGION || 'us-east-1'
        )
      ]
    : [
        fromEnvironment({ nestingSeparator: '__' }),
        fromDotenv({ path: '.env.local', nestingSeparator: '__' })
      ];

const settings = await createSettings(SecureConfigSchema, resolvers, { nestingSeparator: '__' });

// Log config without sensitive data
console.log('Secure Configuration loaded:', {
  environment: settings.environment,
  database: {
    host: settings.database.host,
    port: settings.database.port,
    name: settings.database.name
  }
  // Don't log passwords or API keys!
});

// AWS Secrets Manager secret format (JSON):
// Secret: myapp/database
// {
//   "Database__Host": "prod-db.example.com",
//   "Database__Port": "5432",
//   "Database__Name": "production_db",
//   "Database__User": "app_user",
//   "Database__Password": "super-secret-password"
// }

// Secret: myapp/api-keys
// {
//   "Api__StripeKey": "sk_live_xxxxxxxxxxxxx",
//   "Api__SendGridKey": "SG.xxxxxxxxxxxxx"
// }

export default settings;
