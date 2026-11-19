import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'web/vite.config.js',
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
