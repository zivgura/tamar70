import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API is the Apps Script web app. Its deployment ID lives in one committed file, which CI
// also uses to redeploy the same deployment, so the URL can't drift. VITE_API_URL overrides it
// (e.g. to point a local build at a mock).
const { webAppDeploymentId } = JSON.parse(
  readFileSync(new URL('../apps-script/deployment.json', import.meta.url), 'utf8'),
)
const apiUrl =
  process.env.VITE_API_URL ||
  (webAppDeploymentId ? `https://script.google.com/macros/s/${webAppDeploymentId}/exec` : '')

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
})
