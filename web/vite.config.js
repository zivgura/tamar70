import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'

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
  // SVG files imported with ?react become components, so icons can use currentColor.
  plugins: [react(), svgr()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
})
