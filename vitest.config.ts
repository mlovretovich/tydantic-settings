import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'tydantic-settings',
    globals: true,
    root: __dirname,
    coverage: {
      reportsDirectory: './coverage'
    }
  }
});
