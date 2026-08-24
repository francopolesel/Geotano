import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // CI gate parity: an accidentally skipped suite must fail the run.
    forbidOnly: true,
  },
});
