import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

// Nest loads graphql's CommonJS build; make test code use the same copy
// (otherwise GraphQLScalarType/GraphQLError exist twice and instanceof fails).
const graphqlCjs = createRequire(import.meta.url).resolve('graphql');

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true, alias: [{ find: /^graphql$/, replacement: graphqlCjs }] },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
