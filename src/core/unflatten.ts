import { normalizeKey } from '../utils';

/**
 * Un-flattens an object with delimited keys into a nested object.
 * @example
 * unflatten({ 'database__host': 'localhost' }, '__')
 * // returns { database: { host: 'localhost' } }
 */
export function unflatten(
  obj: Record<string, unknown>,
  separator: string
): Record<string, unknown> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    const parts = key.split(separator);
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = normalizeKey(parts[i]);
      current[part] = current[part] || {};
      current = current[part];
    }
    current[normalizeKey(parts[parts.length - 1])] = obj[key];
  }
  return result;
}
