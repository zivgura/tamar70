// Google Docs links pasted on the add page. No zod here: the site uses this too.

/** The document id in a Google Docs link, or null if it isn't one. */
export function googleDocId(link) {
  const match = String(link ?? '')
    .trim()
    .match(/^https:\/\/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,100})/)
  return match ? match[1] : null
}

/** A doc's exported text, tidied like a Word document's: blank line between paragraphs. */
export function tidyDocText(text) {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
