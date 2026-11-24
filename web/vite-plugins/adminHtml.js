// The admin as its own installable app. A phone decides what an app is (its name, icon and
// start page) from the tags in the HTML it first loads, before any script runs, so changing
// them from JavaScript later is too late for the manifest. This builds a second copy of the
// site's HTML for /admin with the admin's own tags; firebase.json serves it for /admin/**.

const SWAPS = [
  ['href="/icon.svg"', 'href="/icon-admin.svg"'],
  ['href="/apple-touch-icon.png"', 'href="/apple-touch-icon-admin.png"'],
  ['href="/manifest.webmanifest"', 'href="/manifest-admin.webmanifest"'],
  [
    'name="apple-mobile-web-app-title" content="תמר 70"',
    'name="apple-mobile-web-app-title" content="ניהול תמר 70"',
  ],
  ['<title>תמר בת 70</title>', '<title>ניהול האתר – תמר בת 70</title>'],
]

// The public home page's first API call (see early-bootstrap in vite.config.js): the admin
// doesn't use it, so it would only take one of Apps Script's concurrent runs.
const EARLY_BOOTSTRAP = /\s*<script>window\.__tamar70Boot=[\s\S]*?<\/script>/

/** The site's index.html as the admin app's page. Throws if the HTML changed shape. */
export function toAdminHtml(html) {
  let out = String(html)
  for (const [from, to] of SWAPS) {
    if (!out.includes(from)) throw new Error(`admin.html: "${from}" is missing from index.html`)
    out = out.replace(from, to)
  }
  return out.replace(EARLY_BOOTSTRAP, '')
}

/** Adds admin.html next to index.html in the build. */
export function adminHtml() {
  return {
    name: 'admin-html',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const index = bundle['index.html']
        if (!index) throw new Error('admin.html: index.html was not built')
        this.emitFile({ type: 'asset', fileName: 'admin.html', source: toAdminHtml(index.source) })
      },
    },
  }
}
