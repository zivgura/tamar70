import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { isDocx, readDocx } from './readDocx.js'

/** A minimal real .docx with the given paragraphs. */
async function docx(paragraphs) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  )
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  )
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`)
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}</w:body></w:document>`,
  )
  const buffer = await zip.generateAsync({ type: 'arraybuffer' })
  return { name: 'סיפור.docx', type: '', arrayBuffer: async () => buffer }
}

describe('reading a Word document', () => {
  it('takes the paragraphs, a blank line between them', async () => {
    const file = await docx(['זה היה בקיץ של 1975.', '', '', 'ואז עצרה משאית.'])
    expect(await readDocx(file)).toBe('זה היה בקיץ של 1975.\n\nואז עצרה משאית.')
  })

  it('knows a .docx by its type or name', () => {
    expect(isDocx({ name: 'a.DOCX', type: '' })).toBe(true)
    expect(
      isDocx({
        name: 'x',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ).toBe(true)
    expect(isDocx({ name: 'a.doc', type: 'application/msword' })).toBe(false)
  })
})
