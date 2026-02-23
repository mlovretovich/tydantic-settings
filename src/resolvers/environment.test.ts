import { vi, type MockedFunction } from 'vitest';
import { fromEnvironment, fromDotenv } from './index';
import { config as dotenvConfig } from 'dotenv';
import { Type } from '@sinclair/typebox';

// Mock the dotenv library - named export
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('resolvers', () => {
  // Use a schema that reflects the keys we are testing for.
  const mockSchema = Type.Object({
    HOST: Type.String(),
    PORT: Type.String(),
    MY_VAR: Type.String(),
  });
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  describe('fromEnvironment', () => {
    it('should return a resolver function', () => {
      expect(typeof fromEnvironment()).toBe('function');
    });

    it('should resolve values from process.env', async () => {
      process.env.HOST = 'localhost';
      process.env.PORT = '5432';

      const resolver = fromEnvironment();
      const result = await resolver(mockSchema);

      expect(result.HOST).toBe('localhost');
      expect(result.PORT).toBe('5432');
    });

    it('should not include other process.env variables', async () => {
      process.env = { ...originalEnv, MY_VAR: 'hello' };
      const resolver = fromEnvironment();
      const result = await resolver(mockSchema);
      expect(result.MY_VAR).toBe('hello');
    });

    describe('prefix option', () => {
      const prefixSchema = Type.Object({
        HOST: Type.String(),
        PORT: Type.String(),
      });

      it('should filter variables by prefix and strip the prefix', async () => {
        process.env.DATABASE__HOST = 'db-host';
        process.env.DATABASE__PORT = '5432';
        process.env.REDIS__HOST = 'redis-host';
        process.env.OTHER_VAR = 'ignored';

        const resolver = fromEnvironment({ prefix: 'DATABASE__' });
        const result = await resolver(prefixSchema);

        expect(result.HOST).toBe('db-host');
        expect(result.PORT).toBe('5432');
        expect(result.REDIS__HOST).toBeUndefined();
        expect(result.OTHER_VAR).toBeUndefined();
      });

      it('should be case-insensitive by default for prefix matching', async () => {
        process.env.database__host = 'lowercase-host';

        const resolver = fromEnvironment({ prefix: 'DATABASE__' });
        const result = await resolver(prefixSchema);

        expect(result.host).toBe('lowercase-host');
      });

      it('should be case-sensitive when caseSensitive is true', async () => {
        process.env.DATABASE__HOST = 'uppercase-host';
        process.env.database__host = 'lowercase-host';

        const resolver = fromEnvironment({ prefix: 'DATABASE__', caseSensitive: true });
        const result = await resolver(prefixSchema);

        expect(result.HOST).toBe('uppercase-host');
        expect(result.host).toBeUndefined();
      });

      it('should work with nested separators after prefix', async () => {
        const nestedSchema = Type.Object({
          connection: Type.Object({
            host: Type.String(),
          }),
        });

        process.env.DATABASE__CONNECTION__HOST = 'nested-host';

        const resolver = fromEnvironment({
          prefix: 'DATABASE__',
          nestingSeparator: '__',
        });
        const result = await resolver(nestedSchema);

        expect(result.CONNECTION__HOST).toBe('nested-host');
      });
    });
  });

  describe('fromDotenv', () => {
    it('should call dotenv.config with the correct path', async () => {
      const resolver = fromDotenv({ path: '.env.test' });
      await resolver(mockSchema);
      expect(dotenvConfig).toHaveBeenCalledWith({ path: '.env.test' });
    });

    it('should return parsed values from dotenv', async () => {
      // This test needs to simulate what dotenv does: it loads values into process.env.
      // We also need a schema that matches the keys.
      const dotenvSchema = Type.Object({
        DB_HOST: Type.String(),
        DB_PORT: Type.String(),
      });

      (dotenvConfig as MockedFunction<typeof dotenvConfig>).mockReturnValue({
        parsed: {
          DB_HOST: 'db.example.com',
          DB_PORT: '1234',
        },
      });
      process.env.DB_HOST = 'db.example.com';
      process.env.DB_PORT = '1234';

      const resolver = fromDotenv();
      const result = await resolver(dotenvSchema);
      expect(result.DB_HOST).toBe('db.example.com');
      expect(result.DB_PORT).toBe('1234');
    });
  });
});
