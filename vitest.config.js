import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'web/vite.config.js',
      {
        test: {
          name: 'apps-script',
          root: './apps-script',
          environment: 'node',
        },
      },
      {
        test: {
          name: 'shared',
          root: './shared',
          environment: 'node',
        },
      },
    ],
  },
})
