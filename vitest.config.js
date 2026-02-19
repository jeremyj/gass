import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.js'],
    reporters: ['verbose'],
  },
});
