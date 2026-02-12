// Core internal utilities - not exported from main barrel
export { applyDefaults } from './defaults';
export { unflatten } from './unflatten';
export {
  applyComputedProperties,
  type ComputedPropertyFunction,
  type ComputedProperties
} from './computed';
export { processResolvedConfig, mergeResolverResults, type ProcessConfigOptions } from './pipeline';
export {
  isSchemaWithComputed,
  processNestedBundles,
  type SchemaWithComputed
} from './nested-bundles';
