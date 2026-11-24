// The admin pages can be installed as their own app: own name, icon and start page. The site
// is one page (index.html) shared by everything, so while an admin page is open the tags that
// say what the app is are swapped for the admin ones, and put back when the visitor leaves.
// Phones read them when "Add to Home Screen" / "Install" is used.
const IDENTITY = [
  ['link[rel="manifest"]', 'href', '/manifest-admin.webmanifest'],
  ['link[rel="apple-touch-icon"]', 'href', '/apple-touch-icon-admin.png'],
  ['link[rel="icon"]', 'href', '/icon-admin.svg'],
  ['meta[name="apple-mobile-web-app-title"]', 'content', 'ניהול תמר 70'],
]

/** Switches the page to the admin app identity. Returns a function that restores the site's own. */
export function applyAdminAppIdentity() {
  const changed = []
  for (const [selector, attribute, value] of IDENTITY) {
    const element = document.head.querySelector(selector)
    if (!element) continue
    changed.push([element, attribute, element.getAttribute(attribute)])
    element.setAttribute(attribute, value)
  }
  return () => {
    for (const [element, attribute, original] of changed) element.setAttribute(attribute, original)
  }
}
