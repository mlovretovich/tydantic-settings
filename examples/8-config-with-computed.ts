import { Static } from '@sinclair/typebox';
import { Settings, createSettings } from '../src/settings';
import { fromDotenv, fromEnvironment } from '../src/resolvers';
import { fromAwsSecretsManager } from '../src/resolvers/aws';

/**
 * Your Original Config Example - Enhanced with Computed Properties
 *
 * This is your original config.ts with the Database.url computed field added.
 */

const SettingsSchema = Settings({
  environment: Settings.Enum(
    { Development: 'development', Production: 'production', Test: 'test' },
    { default: 'development' }
  ),
  database: Settings({
    host: Settings.String(),
    port: Settings.Number({ default: 5432 }),
    user: Settings.String(),
    password: Settings.String()
  }),
  // Example of a secret that might come from AWS
  apiKey: Settings.Optional(Settings.String()),
  // This would be set in the environment to point to your AWS secret
  awsSecretId: Settings.Optional(Settings.String())
});

// Define the priority of your configuration sources.
// The first resolver in the array has the highest priority.
const separator = '__';
const settings = await createSettings(
  SettingsSchema,
  [
    fromEnvironment({ nestingSeparator: separator }),
    fromAwsSecretsManager(process.env.AWS_SECRET_ID!, process.env.AWS_REGION!),
    fromDotenv({ nestingSeparator: separator })
  ],
  {
    nestingSeparator: separator,
    // Add computed properties
    computed: {
      // database.url - Constructs a PostgreSQL connection string
      'database.url': cfg => {
        const { host, port, user, password } = cfg.database as {
          host: string;
          port: number;
          user: string;
          password: string;
        };
        return `postgresql://${user}:${password}@${host}:${port}`;
      }
    }
  }
);

// Type the settings with computed properties
type Settings = Static<typeof SettingsSchema> & {
  database: Static<typeof SettingsSchema>['database'] & {
    url: string; // Add the computed property to the type
  };
};

export const typedSettings = settings as Settings;

// Now you can use the computed property:
console.log('Database URL:', typedSettings.database.url);
// Output: postgresql://admin:secret123@localhost:5432

// The URL is always in sync with the individual properties
console.log('Database Config:', {
  host: settings.database.host,
  port: settings.database.port,
  user: settings.database.user,
  url: (settings.database as any).url
});
