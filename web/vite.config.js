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

/**
 * Starts the first API call (site.bootstrap) from index.html itself, while the site's code is
 * still downloading. Apps Script takes seconds to answer, so this saves that overlap.
 * src/api/client.js picks the promise up from window.__tamar70Boot.
 */
function earlyBootstrap() {
  return {
    name: 'early-bootstrap',
    transformIndexHtml(html) {
      if (!apiUrl) return html
      const script = `<script>window.__tamar70Boot=fetch(${JSON.stringify(apiUrl)},{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:'{"action":"site.bootstrap","payload":{}}',redirect:'follow'}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})</script>`
      return html.replace('</head>', `    ${script}\n  </head>`)
    },
  }
}

// Which build an error came from: the commit in CI, "dev" locally.
const release = (process.env.GITHUB_SHA ?? '').slice(0, 7) || 'dev'

export default defineConfig({
  // SVG files imported with ?react become components, so icons can use currentColor.
  plugins: [react(), svgr(), earlyBootstrap()],
  build: {
    rollupOptions: {
      output: {
        // Libraries in their own files: they change rarely, so browsers keep them across deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (id.includes('node_modules/react-router')) return 'router'
          if (id.includes('node_modules/@tanstack')) return 'query'
          return undefined
        },
      },
    },
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    'import.meta.env.VITE_RELEASE': JSON.stringify(release),
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
})
