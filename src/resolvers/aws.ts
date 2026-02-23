import { TObject, TSchema } from '@sinclair/typebox';
import { normalizeKey } from '../utils';
import { SettingsResolver } from '../types';

/**
 * Creates a resolver that fetches a JSON secret from AWS Secrets Manager.
 *
 * Requires `@aws-sdk/client-secrets-manager` to be installed:
 * ```
 * npm install @aws-sdk/client-secrets-manager
 * ```
 *
 * @param secretId A single secret ID or an array of secret IDs (or ARNs).
 * @param region The AWS region where the secret is stored.
 * @param options Configuration options for the resolver.
 * @param options.caseSensitive Whether to perform a case-sensitive match for keys in the secret. Defaults to `false`.
 */
export function fromAwsSecretsManager(
  secretId: string | string[],
  region: string,
  options?: { caseSensitive?: boolean; nestingSeparator?: string }
): SettingsResolver {
  const caseSensitive = options?.caseSensitive ?? false;
  const separator = options?.nestingSeparator;

  return async (schema: TSchema) => {
    // Dynamically import the AWS SDK — only loaded when this resolver is actually called
    let awsSdk: typeof import('@aws-sdk/client-secrets-manager');
    try {
      awsSdk = await import('@aws-sdk/client-secrets-manager');
    } catch {
      throw new Error(
        'The "@aws-sdk/client-secrets-manager" package is required to use fromAwsSecretsManager(). ' +
          'Install it with: npm install @aws-sdk/client-secrets-manager'
      );
    }

    console.log('Fetching configuration from AWS Secrets Manager');
    const secretIds = Array.isArray(secretId) ? secretId : [secretId];
    if (secretIds.length === 0 || !secretIds[0]) {
      return {};
    }

    const client = new awsSdk.SecretsManagerClient({ region });

    // Fetch all secrets in parallel for better performance
    const secretPromises = secretIds.map(async id => {
      const command = new awsSdk.GetSecretValueCommand({ SecretId: id });
      try {
        const response = await client.send(command);
        if (response.SecretString) {
          return JSON.parse(response.SecretString) as Record<string, unknown>;
        }
      } catch (error) {
        console.warn(`Could not fetch secret '${id}' from AWS Secrets Manager.`, error);
      }
      return {};
    });

    const resolvedSecrets = await Promise.all(secretPromises);

    // Merge the secrets together, with later secrets in the array overwriting earlier ones.
    const mergedSecrets = resolvedSecrets.reduce((acc, current) => ({ ...acc, ...current }), {});

    if (caseSensitive) {
      return mergedSecrets;
    }

    // Case-insensitive matching
    const config: Partial<Record<string, unknown>> = {};
    const schemaKeys = Object.keys((schema as TObject).properties);
    const secretKeys = Object.keys(mergedSecrets);

    for (const secretKey of secretKeys) {
      const normalizedSecretKey = normalizeKey(secretKey);
      const normalizedSchemaKey = separator
        ? normalizeKey(secretKey.split(separator)[0])
        : normalizedSecretKey;
      if (schemaKeys.some(sk => normalizeKey(sk) === normalizedSchemaKey)) {
        config[secretKey.toUpperCase()] = mergedSecrets[secretKey];
      }
    }
    console.log('Successfully fetched configuration from AWS Secrets Manager');
    return config;
  };
}
