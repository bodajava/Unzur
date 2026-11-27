import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

// Nest loads graphql's CommonJS build; make test code use the same copy
// (otherwise GraphQLScalarType/GraphQLError exist twice and instanceof fails).
const graphqlCjs = createRequire(import.meta.url).resolve('graphql');

export default defineConfig({
  resolve: { tsconfigPaths: true, alias: [{ find: /^graphql$/, replacement: graphqlCjs }] },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Never against the live database by mistake (see test/local-db-guard.ts).
    globalSetup: ['./test/local-db-guard.ts'],
    // Scheduled jobs off in tests; specs call AutomationService.process* directly.
    env: { DISABLE_CRON: 'true' },
    // Files share one database and one Redis (rate-limit counters, background jobs): run them one by one.
    fileParallelism: false,
  },
});
