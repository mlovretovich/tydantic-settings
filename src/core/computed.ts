/**
 * A function that computes a value based on the validated configuration.
 * Computed properties are added after validation and can access other config values.
 */
export type ComputedPropertyFunction<T = any> = (config: T) => any;

/**
 * A map of computed property paths to their computation functions.
 * The path uses dot notation for nested properties (e.g., 'database.url').
 */
export type ComputedProperties<T = any> = Record<string, ComputedPropertyFunction<T>>;

/**
 * Applies computed properties to a configuration object.
 * Computed properties are added using Object.defineProperty as enumerable getters.
 */
export function applyComputedProperties<T extends Record<string, any>>(
  config: T,
  computed: ComputedProperties<T>
): T {
  for (const path in computed) {
    const computeFn = computed[path];
    const parts = path.split('.');

    // Navigate to the parent object
    let target: any = config;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in target)) {
        throw new Error(
          `Cannot add computed property "${path}": parent object "${parts
            .slice(0, i + 1)
            .join('.')}" does not exist`
        );
      }
      target = target[part];
    }

    const propertyName = parts[parts.length - 1];

    // Define the computed property as a getter
    Object.defineProperty(target, propertyName, {
      get: () => computeFn(config),
      enumerable: true, // Make it visible in console.log and JSON.stringify
      configurable: false // Prevent deletion or reconfiguration
    });
  }

  return config;
}
