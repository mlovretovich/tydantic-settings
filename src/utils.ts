/**
 * Normalizes a configuration key to camelCase.
 * This allows for matching keys across different conventions (e.g., 'DATABASE_HOST' or 'database-host' becomes 'databaseHost').
 */
export function normalizeKey(key: string): string {
  // Handle empty strings
  if (!key || key.length === 0) {
    return key;
  }
  // Handle already camelCased or single-word keys
  if (!key.includes('_') && !key.includes('-') && key[0] === key[0].toLowerCase()) {
    return key;
  }
  return key.toLowerCase().replace(/[-_]([a-z0-9])/g, g => g[1].toUpperCase());
}

/**
 * A type guard to check if a value is a non-null object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively freezes an object and all its nested properties.
 * Skips getter properties (computed properties) since they're already read-only.
 */
export function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (descriptor && 'get' in descriptor) continue;
    const value = (obj as any)[key];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}
