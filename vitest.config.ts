import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';

// FAKE values for tests only. A real deployment gets its secrets from `npm run init-secrets`.
const TEST_VIEW_SECRET = 'test-view-secret-000000000000000000';
const TEST_PEOPLE = [
  { id: 'a', name: 'Test Alice', pushToken: 'test-push-token-a-0000000000000000' },
  { id: 'b', name: 'Test Bob', pushToken: 'test-push-token-b-0000000000000000' },
  { id: 'c', name: 'Test Carol', pushToken: 'test-push-token-c-0000000000000000' },
];

export default defineConfig({
  test: {
    // Projects with no matching tests must not fail the run.
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'shared/**/*.test.ts',
            'web/**/*.test.ts',
            'push/**/*.test.ts',
            'scripts/**/*.test.mjs',
          ],
        },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.toml' },
            miniflare: {
              bindings: { VIEW_SECRET: TEST_VIEW_SECRET, PEOPLE: JSON.stringify(TEST_PEOPLE) },
            },
          }),
        ],
        test: {
          name: 'worker',
          include: ['worker/**/*.test.ts'],
        },
      },
    ],
  },
});
