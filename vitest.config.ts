import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15000,
    fileParallelism: false,
    env: {
      AUTH_RATE_LIMIT_MAX: '200',
    },
  },
});
