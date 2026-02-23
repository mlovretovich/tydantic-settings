# Examples

Runnable examples demonstrating tydantic-settings features.

## Getting Started

| Example | Description |
|---------|-------------|
| [1-basic-config.ts](1-basic-config.ts) | Simple configuration with defaults and multiple resolvers |
| [2-multi-environment.ts](2-multi-environment.ts) | Dev/staging/prod environments with `.env` file selection |

## Resolvers

| Example | Description |
|---------|-------------|
| [3-aws-secrets.ts](3-aws-secrets.ts) | AWS Secrets Manager integration with fallback to `.env` |
| [5-custom-resolver.ts](5-custom-resolver.ts) | Building custom resolvers (JSON files, Consul, APIs) |

## Advanced Configuration

| Example | Description |
|---------|-------------|
| [4-complex-nested.ts](4-complex-nested.ts) | Deeply nested configuration with `__` separator |
| [6-coercion-behavior.ts](6-coercion-behavior.ts) | Type coercion enabled vs. strict mode |

## Computed Properties

| Example | Description |
|---------|-------------|
| [7-computed-properties.ts](7-computed-properties.ts) | Computed/derived fields with `Settings()` bundles |
| [8-config-with-computed.ts](8-config-with-computed.ts) | Real-world config composing nested bundles with `defineConfig` |
| [README-computed-properties.md](README-computed-properties.md) | In-depth guide to computed properties |

## Recommended Pattern

| Example | Description |
|---------|-------------|
| [9-define-config.ts](9-define-config.ts) | `defineConfig` singleton pattern with separator inheritance (start here for new projects) |
