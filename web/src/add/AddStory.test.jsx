import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api/client.js'
import { createQueryClient } from '../api/queries.js'
import { readStored, writeStored } from '../lib/storage.js'
import { routes } from '../routes.jsx'
import { bootstrap } from '../test/fixtures.js'
import { uploadPhoto } from '../upload/uploadPhoto.js'

vi.mock('../lib/readDocx.js', async (original) => ({
  ...(await original()),
  readDocx: vi.fn(async () => 'הטקסט מהמסמך.\n\nפסקה שנייה.'),
}))

vi.mock('../upload/uploadPhoto.js', async (original) => ({
  ...(await original()),
  uploadPhoto: vi.fn(),
}))

// applyAccept off: a real file picker can still hand over a non-photo, and the app must cope.
const user = userEvent.setup({ applyAccept: false })

function renderAdd(path = '/add') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

const photoFile = (name) => new File([new Uint8Array(100)], name, { type: 'image/jpeg' })

beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(api, 'bootstrap').mockResolvedValue(bootstrap())
  vi.spyOn(api, 'submitStory').mockResolvedValue({ id: 'st_new000001', duplicate: false })
  // The fast all-at-once path is tested in sendStory.test.js; here every photo takes the
  // one-at-a-time path, so the tests can follow each upload.
  vi.spyOn(api, 'startUploads').mockRejectedValue(new ApiError('network', 'offline'))
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:photo')
  globalThis.URL.revokeObjectURL = vi.fn()
  HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true
  }
  uploadPhoto.mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('adding a story', () => {
  it('takes the story from a Word document and keeps the file', async () => {
    uploadPhoto.mockResolvedValue({})
    renderAdd()
    await user.click(await screen.findByRole('button', { name: 'כתיבה' }))
    await user.type(screen.getByLabelText('השם שלכם'), 'ענת')
    await user.click(screen.getByRole('button', { name: 'המשך' }))

    // Closed until opened
    const panel = screen.getByText('כבר כתבתם את הסיפור?').closest('details')
    expect(panel).not.toHaveAttribute('open')
    await user.click(screen.getByText('כבר כתבתם את הסיפור?'))
    expect(panel).toHaveAttribute('open')

    const file = new File(['x'], 'הסיפור שלי.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    await user.upload(screen.getByLabelText('בחירת מסמך Word'), file)
    expect(await screen.findByLabelText('הסיפור')).toHaveValue('הטקסט מהמסמך.\n\nפסקה שנייה.')
    expect(screen.getByText(/נכנס לסיפור/)).toHaveTextContent('הסיפור שלי.docx')

    await user.click(screen.getByRole('button', { name: 'שליחה' }))
    expect(await screen.findByRole('heading', { name: 'תודה!' })).toBeInTheDocument()
    expect(api.submitStory.mock.calls[0][0].content).toBe('הטקסט מהמסמך.\n\nפסקה שנייה.')
    expect(uploadPhoto).toHaveBeenCalledTimes(1)
    expect(uploadPhoto.mock.calls[0][0]).toMatchObject({ file, storyId: 'st_new000001' })
  })

  it('takes the story from a Google Docs link, and explains an unshared one', async () => {
    const link = 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit'
    vi.spyOn(api, 'importGoogleDoc')
      .mockRejectedValueOnce(new ApiError('doc_not_shared'))
      .mockResolvedValueOnce({ text: 'מהגוגל דוקס.' })
    renderAdd()
    await user.click(await screen.findByRole('button', { name: 'כתיבה' }))
    await user.type(screen.getByLabelText('השם שלכם'), 'ענת')
    await user.click(screen.getByRole('button', { name: 'המשך' }))

    await user.click(screen.getByText('כבר כתבתם את הסיפור?'))
    await user.type(screen.getByLabelText('או קישור ל-Google Docs:'), 'not a link')
    await user.click(screen.getByRole('button', { name: 'ייבוא' }))
    expect(screen.getByText('זה לא קישור למסמך Google Docs.')).toBeInTheDocument()
    expect(api.importGoogleDoc).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('או קישור ל-Google Docs:'))
    await user.type(screen.getByLabelText('או קישור ל-Google Docs:'), link)
    await user.click(screen.getByRole('button', { name: 'ייבוא' }))
    expect(await screen.findByText(/כל מי שיש לו את הקישור" ונסו שוב/)).toBeInTheDocument()

    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled
    await user.click(screen.getByRole('button', { name: 'ייבוא' }))
    expect(await screen.findByLabelText('הסיפור')).toHaveValue('מהגוגל דוקס.')
    expect(api.importGoogleDoc).toHaveBeenLastCalledWith(link)
    // The page scrolls down to the story box, where the text now is.
    await vi.waitFor(() => expect(scrolled).toHaveBeenCalled())
    expect(scrolled.mock.contexts.at(-1)).toContainElement(screen.getByLabelText('הסיפור'))
    delete Element.prototype.scrollIntoView
  })

  it('says so when submissions are closed', async () => {
    api.bootstrap.mockResolvedValue(
      bootstrap({ site: { ...bootstrap().site, submissions_open: false } }),
    )
    renderAdd()
    expect(await screen.findByText('ההוספה סגורה כרגע')).toBeInTheDocument()
  })

  it('walks through writing a story, then thanks with the new card', async () => {
    let finishSubmit
    api.submitStory.mockImplementationOnce(
      () => new Promise((resolve) => (finishSubmit = () => resolve({ id: 'st_new000001' }))),
    )
    renderAdd('/add?corner=travels')
    expect(await screen.findByText('שלב 1 מתוך 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'כתיבה' }))

    // Step 2: who's writing, before the story
    expect(screen.getByText('שלב 2 מתוך 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'המשך' }))
    expect(screen.getByText('כתבו את השם שלכם')).toBeInTheDocument()
    await user.type(screen.getByLabelText('השם שלכם'), 'ענת')
    await user.type(screen.getByLabelText(/איך אתם מכירים/), 'חברה מהצבא')
    await user.click(screen.getByRole('button', { name: 'המשך' }))
    expect(readStored('author')).toEqual({ name: 'ענת', relation: 'חברה מהצבא' })

    // Step 3: the corner from the link is already chosen, and its prompt is shown
    expect(screen.getByText('שלב 3 מתוך 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'טיולים בארץ ובעולם' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('שאלה על טיולים בארץ ובעולם')).toBeInTheDocument()
    expect(screen.getByText(/עשויים לשמש במשחק משפחתי/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'שליחה' }))
    expect(screen.getByText('כתבו כמה מילים, אפילו משפט אחד')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/כותרת/), 'הטרמפ לאילת')
    await user.type(screen.getByLabelText('הסיפור'), 'זה היה בקיץ של 1975. ואז...')
    expect(screen.getByText('27 / 10,000')).toBeInTheDocument()
    await user.click(screen.getByText('הוסיפו פרטים (רשות)'))
    await user.click(screen.getByRole('button', { name: 'שנות ה-70' }))
    await user.type(screen.getByLabelText(/איפה/), 'אילת, הערבה')
    await user.click(screen.getByRole('button', { name: 'שליחה' }))

    // While sending: a loader
    expect(await screen.findByRole('status', { name: 'שולחים את הסיפור' })).toBeInTheDocument()
    expect(screen.getByText('שומרים את הסיפור…')).toBeInTheDocument()
    finishSubmit()

    expect(await screen.findByRole('heading', { name: 'תודה!' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'שולחים את הסיפור' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'עריכת הסיפור' })).toHaveAttribute(
      'href',
      '/edit/st_new000001',
    )
    const payload = api.submitStory.mock.calls[0][0]
    expect(payload).toMatchObject({
      kind: 'text',
      author_name: 'ענת',
      author_relation: 'חברה מהצבא',
      title: 'הטרמפ לאילת',
      category_id: 'travels',
      decade: 1970,
      places: ['אילת', 'הערבה'],
    })
    expect(payload.edit_token).toMatch(/^[0-9a-f]{48}$/)
    expect(screen.getByText('זה היה בקיץ של 1975.')).toBeInTheDocument() // the card's excerpt

    // Remembered on the device: this story with its edit token; the draft is gone
    expect(readStored('mine').st_new000001.token).toBe(payload.edit_token)
    expect(readStored('draft')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'הוסיפו סיפור נוסף' }))
    expect(screen.getByText('מה תרצו לשתף?')).toBeInTheDocument()
  })

  it('uploads photos, and retries only the ones that failed', async () => {
    uploadPhoto
      .mockImplementationOnce(async ({ onProgress }) => onProgress(1))
      .mockRejectedValueOnce(new ApiError('network', 'dropped'))
      .mockResolvedValueOnce({})
    writeStored('author', { name: 'רונית', relation: '' })
    renderAdd()
    await user.click(await screen.findByRole('button', { name: 'תמונות' }))
    expect(screen.getByLabelText('השם שלכם')).toHaveValue('רונית') // remembered
    await user.click(screen.getByRole('button', { name: 'המשך' }))
    await user.click(screen.getByRole('button', { name: 'שליחה' }))
    expect(screen.getByText('בחרו לפחות תמונה אחת')).toBeInTheDocument()

    await user.upload(screen.getByLabelText(/הוסיפו תמונות/), [
      photoFile('a.jpg'),
      photoFile('b.jpg'),
      new File(['x'], 'doc.pdf', { type: 'application/pdf' }),
    ])
    expect(screen.getByText('זה לא קובץ תמונה שאפשר להעלות')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'שליחה' }))

    expect(await screen.findByText('הסיפור נשמר, אבל תמונה אחת לא הועלתה.')).toBeInTheDocument()
    expect(api.submitStory.mock.calls[0][0]).toMatchObject({ kind: 'photos', content: '' })
    expect(uploadPhoto).toHaveBeenCalledTimes(2) // the PDF was never sent

    await user.click(screen.getByRole('button', { name: 'נסו שוב להעלות' }))
    expect(await screen.findByRole('heading', { name: 'תודה!' })).toBeInTheDocument()
    expect(uploadPhoto).toHaveBeenCalledTimes(3)
    expect(uploadPhoto.mock.calls[2][0].file.name).toBe('b.jpg')
    expect(api.submitStory).toHaveBeenCalledTimes(1)
    expect(screen.getByText('2 תמונות מצורפות')).toBeInTheDocument()
  })

  it('keeps the draft on the device and brings it back', async () => {
    writeStored('author', { name: 'דני', relation: '' })
    const { unmount } = renderAdd()
    await user.click(await screen.findByRole('button', { name: 'כתיבה' }))
    await user.click(screen.getByRole('button', { name: 'המשך' }))
    await user.type(screen.getByLabelText('הסיפור'), 'טיוטה ארוכה')
    unmount()

    renderAdd()
    expect(await screen.findByLabelText('הסיפור')).toHaveValue('טיוטה ארוכה')
    expect(screen.getByText('שלב 3 מתוך 3')).toBeInTheDocument()
  })

  it('shows a server refusal and lets the person try again', async () => {
    api.submitStory.mockRejectedValueOnce(new ApiError('busy', 'busy'))
    writeStored('draft', { step: 3, kind: 'text', content: 'סיפור', title: '' })
    writeStored('author', { name: 'דני', relation: '' })
    renderAdd()
    await user.click(await screen.findByRole('button', { name: 'שליחה' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('יש עומס רגעי')
    await user.click(screen.getByRole('button', { name: 'שליחה' }))
    expect(await screen.findByRole('heading', { name: 'תודה!' })).toBeInTheDocument()
    const [first, second] = api.submitStory.mock.calls.map((c) => c[0].edit_token)
    expect(second).toBe(first) // same token: a retry can't create a duplicate
  })

  it('collects a name and year from a button under each photo', async () => {
    writeStored('author', { name: 'דני', relation: '' })
    renderAdd()
    await user.click(await screen.findByRole('button', { name: 'כתיבה ותמונות' }))
    await user.click(screen.getByRole('button', { name: 'המשך' }))
    await user.upload(screen.getByLabelText(/הוסיפו תמונות/), [
      photoFile('beach.jpg'),
      photoFile('home.jpg'),
    ])
    expect(screen.getByText('0 מתוך 2 תמונות עם פרטים')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'פרטי התמונה beach.jpg' }))
    const dialog = screen.getByRole('dialog', { name: 'פרטי התמונה' })
    await user.type(within(dialog).getByLabelText(/שם התמונה/), 'בים')
    await user.type(within(dialog).getByLabelText(/שנה/), '1975')
    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }))
    // The button now shows what was entered, and the counter moves.
    const button = screen.getByRole('button', { name: 'פרטי התמונה beach.jpg' })
    expect(button).toHaveTextContent('בים')
    expect(button).toHaveTextContent('1975')
    expect(screen.getByText('1 מתוך 2 תמונות עם פרטים')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'פרטי התמונה home.jpg' })).toHaveTextContent(
      'שם ושנה',
    )
  })

  it('flags a year the server would refuse and blocks saving it', async () => {
    writeStored('author', { name: 'דני', relation: '' })
    renderAdd()
    await user.click(await screen.findByRole('button', { name: 'כתיבה ותמונות' }))
    await user.click(screen.getByRole('button', { name: 'המשך' }))
    await user.upload(screen.getByLabelText(/הוסיפו תמונות/), [photoFile('old.jpg')])
    await user.click(screen.getByRole('button', { name: 'פרטי התמונה old.jpg' }))
    const dialog = screen.getByRole('dialog', { name: 'פרטי התמונה' })
    await user.type(within(dialog).getByLabelText(/שנה/), '1850')
    expect(within(dialog).getByText('שנה בין 1940 ל-2030')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'שמירה' })).toBeDisabled()
  })
})
