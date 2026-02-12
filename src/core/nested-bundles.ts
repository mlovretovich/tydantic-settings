import { TObject, TSchema } from '@sinclair/typebox';
import { ComputedProperties } from './computed';

/**
 * A schema bundled with its computed properties.
 * This allows libraries to export both schema and computed properties together,
 * making it easier for applications to compose multiple library configurations.
 */
export interface SchemaWithComputed<
  TSchemaType extends TObject = TObject,
  TComputed extends ComputedProperties<any> = ComputedProperties<any>,
  TInferredType = any
> {
  schema: TSchemaType;
  computed: TComputed;
  /** Type hint for InferConfigType - reflects the actual object shape including nested bundles */
  _inferredType?: TInferredType;
}

/**
 * Checks if a value is a SchemaWithComputed bundle.
 */
export function isSchemaWithComputed(value: unknown): value is SchemaWithComputed<any, any> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'schema' in value &&
    'computed' in value &&
    typeof (value as any).schema === 'object' &&
    typeof (value as any).computed === 'object'
  );
}

/**
 * Recursively extracts schemas from nested SchemaWithComputed bundles
 * and collects their computed properties with proper path prefixes.
 */
export function processNestedBundles(
  properties: Record<string, unknown>,
  pathPrefix: string = ''
): {
  extractedProperties: Record<string, TSchema>;
  collectedComputed: Record<string, (config: any) => any>;
} {
  const extractedProperties: Record<string, TSchema> = {};
  const collectedComputed: Record<string, (config: any) => any> = {};

  for (const [key, value] of Object.entries(properties)) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    if (isSchemaWithComputed(value)) {
      // It's a bundle - extract schema and scope computed properties
      extractedProperties[key] = value.schema;

      // Scope each computed property to this path
      for (const [computedKey, computedFn] of Object.entries(value.computed) as [
        string,
        (config: any) => any
      ][]) {
        collectedComputed[`${currentPath}.${computedKey}`] = (fullConfig: any) => {
          // Navigate to the nested object
          const nestedConfig = currentPath
            .split('.')
            .reduce((obj, part) => obj?.[part], fullConfig);
          return computedFn(nestedConfig);
        };
      }

      // Recursively process if the bundle's schema has nested bundles
      if (value.schema.properties) {
        const nested = processNestedBundles(value.schema.properties, currentPath);
        extractedProperties[key] = {
          ...value.schema,
          properties: { ...value.schema.properties, ...nested.extractedProperties }
        } as TObject;
        Object.assign(collectedComputed, nested.collectedComputed);
      }
    } else if (
      typeof value === 'object' &&
      value !== null &&
      'properties' in value &&
      typeof (value as any).properties === 'object'
    ) {
      // It's a regular TObject schema - check for nested bundles inside
      const nested = processNestedBundles((value as TObject).properties, currentPath);

      extractedProperties[key] = {
        ...value,
        properties: nested.extractedProperties
      } as unknown as TSchema;

      Object.assign(collectedComputed, nested.collectedComputed);
    } else {
      // Regular schema property - keep as-is
      extractedProperties[key] = value as TSchema;
    }
  }

  return { extractedProperties, collectedComputed };
}
