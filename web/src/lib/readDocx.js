// Reads the text out of a Word (.docx) file in the browser. The reader is loaded only when
// someone picks a document, so nobody else downloads it.
import { DOCX_TYPE } from '@tamar70/shared'

export function isDocx(file) {
  return file.type === DOCX_TYPE || /\.docx$/i.test(file.name ?? '')
}

/** The document's text: paragraphs separated by a blank line, extra blank lines dropped. */
export async function readDocx(file) {
  const module = await import('mammoth')
  const mammoth = module.default ?? module
  const arrayBuffer = await file.arrayBuffer()
  // The browser build reads `arrayBuffer`; the Node build (tests) reads `buffer`.
  const buffer = globalThis.Buffer?.from(arrayBuffer)
  const { value } = await mammoth.extractRawText({ arrayBuffer, buffer })
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
