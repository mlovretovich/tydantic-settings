import { vi } from 'vitest';
import { fromAwsSecretsManager } from './aws';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Type } from '@sinclair/typebox';

// Create a shared mock send function
const mockSend = vi.fn();

// Mock the AWS SDK client - use a class for proper constructor behavior
vi.mock('@aws-sdk/client-secrets-manager', () => {
  return {
    SecretsManagerClient: class MockSecretsManagerClient {
      send = mockSend;
    },
    GetSecretValueCommand: class MockGetSecretValueCommand {
      constructor(public params: unknown) {}
    }
  };
});

describe('fromAwsSecretsManager', () => {
  const mockSchema = Type.Object({
    API_KEY: Type.String(),
    DB_PASS: Type.String()
  });

  beforeEach(() => {
    // Clear mock call history before each test
    mockSend.mockClear();
  });

  it('should return an empty object if secretId is not provided', async () => {
    const resolver = fromAwsSecretsManager('', 'us-east-1');
    const result = await resolver(mockSchema);
    expect(result).toEqual({});
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should return parsed JSON from SecretString with case-sensitive mode', async () => {
    const secretData = { API_KEY: '12345', DB_PASS: 'secret' };
    mockSend.mockResolvedValue({
      SecretString: JSON.stringify(secretData)
    });

    const resolver = fromAwsSecretsManager('my-secret-id', 'us-east-1', { caseSensitive: true });
    const result = await resolver(mockSchema);

    expect(result).toEqual(secretData);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should return parsed JSON from SecretString with case-insensitive matching', async () => {
    const secretData = { api_key: '12345', db_pass: 'secret' };
    mockSend.mockResolvedValue({
      SecretString: JSON.stringify(secretData)
    });

    const resolver = fromAwsSecretsManager('my-secret-id', 'us-east-1');
    const result = await resolver(mockSchema);

    // Case-insensitive matching should map api_key -> API_KEY, db_pass -> DB_PASS
    expect(result).toEqual({
      API_KEY: '12345',
      DB_PASS: 'secret'
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should return an empty object if SecretString is empty', async () => {
    mockSend.mockResolvedValue({ SecretString: undefined });
    const resolver = fromAwsSecretsManager('my-secret-id', 'us-east-1');
    const result = await resolver(mockSchema);
    expect(result).toEqual({});
  });

  it('should handle errors from AWS gracefully', async () => {
    mockSend.mockRejectedValue(new Error('AWS error'));

    // Suppress console.warn for this test
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const resolver = fromAwsSecretsManager('my-secret-id', 'us-east-1');
    const result = await resolver(mockSchema);
    expect(result).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not fetch secret'),
      expect.any(Error)
    );
    consoleWarnSpy.mockRestore();
  });
});
