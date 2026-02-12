import { Settings, createSettings } from '../src/settings';
import { fromEnvironment } from '../src/resolvers';

/**
 * Coercion Behavior Example
 *
 * This example demonstrates the difference between coercion enabled and disabled:
 * - With coercion (default): Environment variables (strings) are converted to the correct type
 * - Without coercion: Strict type checking, strings must match exactly
 *
 * Environment variables are always strings, so coercion is typically needed.
 */

const CoercionSchema = Settings({
  server: Settings({
    port: Settings.Number({ default: 3000 }),
    maxConnections: Settings.Number({ default: 100 }),
    enableSsl: Settings.Boolean({ default: false })
  }),
  features: Settings({
    rateLimit: Settings.Number({ default: 100 }),
    debug: Settings.Boolean({ default: false })
  })
});

console.log('=== Example 1: Coercion ENABLED (default) ===\n');

// Set environment variables as strings (how they come from the environment)
process.env.SERVER__PORT = '8080';
process.env.SERVER__MAX_CONNECTIONS = '500';
process.env.SERVER__ENABLE_SSL = 'true';
process.env.FEATURES__RATE_LIMIT = '1000';
process.env.FEATURES__DEBUG = 'false';

try {
  const configWithCoercion = await createSettings(
    CoercionSchema,
    [fromEnvironment({ nestingSeparator: '__' })],
    {
      nestingSeparator: '__',
      coerce: true // Default behavior
    }
  );

  console.log('SUCCESS - Config loaded with coercion:');
  console.log(JSON.stringify(configWithCoercion, null, 2));
  console.log('\nType checking:');
  console.log(`  Port type: ${typeof configWithCoercion.server.port}`); // number
  console.log(`  EnableSsl type: ${typeof configWithCoercion.server.enableSsl}`); // boolean
  console.log(`  Port value: ${configWithCoercion.server.port}`); // 8080
  console.log(`  EnableSsl value: ${configWithCoercion.server.enableSsl}`); // true
} catch (error) {
  console.error('FAILED:', error);
}

console.log('\n\n=== Example 2: Coercion DISABLED ===\n');

try {
  const configWithoutCoercion = await createSettings(
    CoercionSchema,
    [fromEnvironment({ nestingSeparator: '__' })],
    {
      nestingSeparator: '__',
      coerce: false // Strict mode
    }
  );

  console.log('Config loaded WITHOUT coercion:');
  console.log(JSON.stringify(configWithoutCoercion, null, 2));
} catch (error) {
  console.error('EXPECTED FAILURE - Type validation error:');
  console.error((error as Error).message);
  console.error('\nThis fails because environment variables are strings,');
  console.error('but the schema expects numbers and booleans.');
}

console.log('\n\n=== Example 3: Coercion DISABLED with correct types ===\n');

// Clear string env vars and provide actual typed values via a custom resolver
delete process.env.SERVER__PORT;
delete process.env.SERVER__MAX_CONNECTIONS;
delete process.env.SERVER__ENABLE_SSL;
delete process.env.FEATURES__RATE_LIMIT;
delete process.env.FEATURES__DEBUG;

// Custom resolver that provides correctly typed values
const fromTypedObject = (data: any) => async () => data;

try {
  const configStrictMode = await createSettings(
    CoercionSchema,
    [
      fromTypedObject({
        server: {
          port: 8080, // Already a number
          maxConnections: 500, // Already a number
          enableSsl: true // Already a boolean
        },
        features: {
          rateLimit: 1000, // Already a number
          debug: false // Already a boolean
        }
      })
    ],
    {
      coerce: false // Strict mode - no coercion needed
    }
  );

  console.log('SUCCESS - Config loaded in strict mode with typed values:');
  console.log(JSON.stringify(configStrictMode, null, 2));
  console.log('\nThis works because the values are already the correct type.');
} catch (error) {
  console.error('FAILED:', error);
}

// Use Cases:
//
// 1. Coercion ENABLED (default):
//    - Best for most applications
//    - Works seamlessly with environment variables
//    - Converts "123" -> 123, "true" -> true, etc.
//    - Recommended for production
//
// 2. Coercion DISABLED:
//    - Strict type checking
//    - Useful when config comes from typed sources (JSON files, APIs, etc.)
//    - Catches type mismatches early
//    - Better for testing configuration pipelines
//    - Recommended when you have full control over config sources

export {};
