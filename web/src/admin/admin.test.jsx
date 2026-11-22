import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from '../api/client.js'
import { ApiError } from '../api/client.js'
import { createQueryClient } from '../api/queries.js'
import { routes } from '../routes.jsx'
import { categories } from '../test/fixtures.js'
import { isFresh, readClaims } from './session.js'

const user = userEvent.setup()

const b64 = (obj) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const jwt = (claims) => `${b64({ alg: 'RS256' })}.${b64(claims)}.sig`
const TOKEN = jwt({ email: 'owner@example.test', name: 'בעלת האתר', exp: Date.now() / 1000 + 3600 })

const story = (overrides = {}) => ({
  id: 'st_aaaaaa01',
  kind: 'mixed',
  title: 'הטרמפ לאילת',
  excerpt: 'זה היה בקיץ של 1975.',
  content: 'זה היה בקיץ של 1975. ואז עוד.',
  author_name: 'ענת',
  author_relation: 'חברה מהצבא',
  category_id: 'travels',
  status: 'active',
  visibility: 'default',
  media_count: 1,
  created_at: '2026-12-01T10:00:00.000Z',
  updated_at: '2026-12-01T10:00:00.000Z',
  admin_notes: '',
  ...overrides,
})

const adminCategories = categories.map(({ id, name }) => ({ id, name, active: true }))
let apiCall
let stories
let game

const gameStatus = (overrides = {}) => ({
  ai_configured: true,
  model: 'claude-opus-5-5',
  models: [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', input: 4, output: 20 },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', input: 2, output: 10 },
  ],
  counts: { facts: 0, facts_kept: 0, puzzles: 0, puzzles_approved: 0 },
  jobs: [],
  ...overrides,
})

function answer(action, payload) {
  if (payload.id_token !== TOKEN) throw new ApiError('sign_in_required')
  switch (action) {
    case 'admin.me':
      return { email: 'owner@example.test', name: 'Owner' }
    case 'admin.stories':
      return { site_status: 'collecting', categories: adminCategories, stories }
    case 'admin.story':
      return {
        story: stories.find((s) => s.id === payload.id),
        categories: adminCategories,
        photos: [
          {
            id: 'md_photo0001',
            filename: 'eilat.jpg',
            caption: 'בדרך',
            upload_status: 'done',
            bytes: 2_500_000,
            thumbnail: 'data:image/png;base64,AAA',
          },
        ],
      }
    case 'admin.setSiteStatus':
      return {
        site_status: payload.site_status,
        sharing: { shared: 3, total: 5, to_close: 0 },
        notify_mode: 'each',
        recipients: ['owner@example.test'],
        housekeeping_ran_at: '2026-12-02T10:00:00Z',
      }
    case 'admin.settings':
      return {
        site_status: 'collecting',
        sharing: { shared: 0, total: 0, to_close: 0 },
        notify_mode: 'each',
        recipients: ['owner@example.test'],
        housekeeping_ran_at: '2026-12-02T10:00:00Z',
        backup: { backed_up_at: null, folder_url: 'https://drive/folder' },
      }
    case 'admin.backup':
      return { backed_up_at: '2026-12-02T12:00:00Z', url: 'https://sheet' }
    case 'admin.settingsUpdate':
      return {
        site_status: 'collecting',
        sharing: { shared: 0, total: 0, to_close: 0 },
        notify_mode: payload.notify_mode,
        recipients: ['owner@example.test'],
      }
    case 'admin.testEmail':
      return { sent: true, recipients: ['owner@example.test'] }
    case 'admin.stats':
      return {
        totals: { devices: 12 },
        days: [{ date: '2026-12-02', devices: 5, new_devices: 3, stories: 2, photos: 7 }],
        errors: [
          {
            id: 'er_1',
            ts: '2026-12-02T10:00:00Z',
            last_seen: '2026-12-02T11:00:00Z',
            message: 'x is undefined',
            path: '/story/st_1',
            release: 'abc1234',
            count: 3,
            stack: 'at Story',
            user_agent: 'iPhone',
          },
        ],
      }
    case 'admin.game':
      return game
    case 'admin.gameConfig':
      game = { ...game, model: payload.model }
      return game
    case 'admin.gameJobStart': {
      const job = {
        id: 'gj_1',
        kind: payload.kind,
        status: 'queued',
        created_at: '2026-12-02T10:00:00Z',
        cost_usd: 0,
        error: null,
      }
      game = { ...game, jobs: [job] }
      return { job, ...game }
    }
    default:
      return {}
  }
}

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  window.sessionStorage.clear()
  game = gameStatus()
  stories = [
    story(),
    story({ id: 'st_aaaaaa02', title: 'מוסתר', visibility: 'hidden' }),
    story({ id: 'st_aaaaaa03', title: 'נמחק', status: 'deleted' }),
  ]
  apiCall = vi
    .spyOn(client, 'apiCall')
    .mockImplementation(async (action, payload) => answer(action, payload))
  // Google's library: a button that "signs in" when clicked.
  window.google = {
    accounts: {
      id: {
        initialize: vi.fn(function (config) {
          this.config = config
        }),
        renderButton: vi.fn(function (el) {
          const button = document.createElement('button')
          button.textContent = 'כניסה עם Google'
          button.onclick = () => this.config.callback({ credential: TOKEN })
          el.replaceChildren(button)
        }),
        prompt: vi.fn(),
        disableAutoSelect: vi.fn(),
      },
    },
  }
  HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close ??= function () {
    this.open = false
  }
})
afterEach(() => {
  vi.restoreAllMocks()
  delete window.google
})

describe('admin session', () => {
  it('reads the claims of a Google token', () => {
    expect(readClaims(TOKEN)).toMatchObject({ email: 'owner@example.test', name: 'בעלת האתר' })
    expect(isFresh(TOKEN)).toBe(true)
    expect(isFresh(jwt({ exp: Date.now() / 1000 + 60 }))).toBe(false)
    expect(readClaims('nonsense')).toBeNull()
  })
})

describe('admin pages', () => {
  it('asks to sign in, then lists the stories on the site', async () => {
    renderAt('/admin')
    await user.click(await screen.findByRole('button', { name: 'כניסה עם Google' }))
    expect(await screen.findByRole('heading', { name: 'הסיפורים' })).toBeInTheDocument()
    expect(screen.getByText('הטרמפ לאילת')).toBeInTheDocument()
    expect(screen.queryByText('מוסתר', { selector: 'span' })).not.toBeInTheDocument()
    expect(apiCall).toHaveBeenCalledWith('admin.me', { id_token: TOKEN })
  })

  it('filters hidden and deleted stories', async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin')
    await user.click(await screen.findByRole('button', { name: 'נמחקו (1)' }))
    expect(screen.getByText('נמחק', { selector: '[class*=rowTitle]' })).toBeInTheDocument()
    expect(screen.queryByText('הטרמפ לאילת')).not.toBeInTheDocument()
  })

  it('tells a Google account that is not an admin', async () => {
    apiCall.mockImplementation(async () => {
      throw new ApiError('not_admin')
    })
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin')
    expect(await screen.findByText(/לא ברשימת המנהלות/)).toBeInTheDocument()
  })

  it('goes back to sign-in when the server says the sign-in expired', async () => {
    apiCall.mockImplementation(async () => {
      throw new ApiError('sign_in_required')
    })
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin')
    expect(await screen.findByText('הכניסה פגה. היכנסו שוב כדי להמשיך.')).toBeInTheDocument()
    expect(window.sessionStorage.getItem('tamar70.adminToken')).toBeNull()
  })

  it('marks the current tab, with a story under the stories tab', async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/story/st_aaaaaa01')
    const tabs = within(await screen.findByRole('navigation', { name: 'אזורי הניהול' }))
    expect(tabs.getByRole('link', { name: 'הסיפורים' })).toHaveAttribute('aria-current', 'page')
    expect(tabs.getByRole('link', { name: 'הגדרות' })).not.toHaveAttribute('aria-current')
  })

  it('hides a story', async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/story/st_aaaaaa01')
    await user.click(await screen.findByRole('button', { name: 'הסתרה מהאתר' }))
    expect(await screen.findByText('הסיפור הוסתר. אפשר להחזיר אותו בכל רגע.')).toBeInTheDocument()
    expect(apiCall).toHaveBeenCalledWith('admin.setVisibility', {
      id: 'st_aaaaaa01',
      visibility: 'hidden',
      id_token: TOKEN,
    })
  })

  it('deletes a story only after confirming', async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/story/st_aaaaaa01')
    await user.click(await screen.findByRole('button', { name: 'מחיקת הסיפור' }))
    expect(apiCall).not.toHaveBeenCalledWith('admin.storyDelete', expect.anything())
    const dialog = screen.getByRole('dialog', { name: 'למחוק את הסיפור?' })
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }))
    expect(await screen.findByText('הסיפור נמחק.')).toBeInTheDocument()
    expect(apiCall).toHaveBeenCalledWith('admin.storyDelete', {
      id: 'st_aaaaaa01',
      id_token: TOKEN,
    })
  })

  it('removes one photo', async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/story/st_aaaaaa01')
    await user.click(await screen.findByRole('button', { name: 'הסרת התמונה eilat.jpg' }))
    const dialog = screen.getByRole('dialog', { name: 'להסיר את התמונה?' })
    await user.click(within(dialog).getByRole('button', { name: 'הסרה' }))
    expect(await screen.findByText('התמונה הוסרה.')).toBeInTheDocument()
    expect(apiCall).toHaveBeenCalledWith('admin.mediaRemove', {
      media_id: 'md_photo0001',
      id_token: TOKEN,
    })
  })

  it("shows visits per day and errors from people's phones", async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/stats')
    expect(await screen.findByRole('heading', { name: 'נתונים' })).toBeInTheDocument()
    expect(screen.getByText('מכשירים שנכנסו').nextSibling).toHaveTextContent('12')
    expect(screen.getByRole('rowheader', { name: '2.12' })).toBeInTheDocument()
    expect(screen.getByText('x is undefined')).toBeInTheDocument()
    expect(screen.getByText(/3 פעמים/)).toBeInTheDocument()
  })

  it('explains how to add the Claude key when there is none', async () => {
    game = gameStatus({ ai_configured: false })
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/game')
    expect(await screen.findByRole('heading', { name: 'חדר בריחה' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'חדר בריחה' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText(/עוד אין מפתח API/)).toBeInTheDocument()
    expect(screen.getByText('CLAUDE_API_KEY')).toBeInTheDocument()
  })

  it('checks the Claude connection in the background and shows the answer', async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/game')
    await user.click(await screen.findByRole('button', { name: 'בדיקת החיבור' }))
    expect(apiCall).toHaveBeenCalledWith('admin.gameJobStart', { kind: 'check', id_token: TOKEN })
    expect(await screen.findByText('שולחים ל-Claude בקשה קטנה…')).toBeInTheDocument()
    expect(screen.getByText('ממתינה')).toBeInTheDocument()
  })

  it('shows a finished check and a failed one', async () => {
    game = gameStatus({
      jobs: [
        {
          id: 'gj_2',
          kind: 'check',
          status: 'done',
          progress: { reply: 'שלום' },
          created_at: '2026-12-02T10:05:00Z',
          cost_usd: 0.006,
          error: null,
        },
        {
          id: 'gj_1',
          kind: 'check',
          status: 'failed',
          created_at: '2026-12-02T10:00:00Z',
          cost_usd: 0,
          error: 'מפתח ה-API לא תקין. בדקו את CLAUDE_API_KEY.',
        },
      ],
    })
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/game')
    expect(await screen.findByText(/החיבור עובד. Claude ענה: "שלום"/)).toHaveTextContent(
      'העלות: $0.0060',
    )
    expect(screen.getByText('נכשלה')).toBeInTheDocument()
    expect(screen.getByText(/עלות כל העבודות ברשימה/)).toHaveTextContent('$0.0060')
  })

  it('switches the model', async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/game')
    expect(await screen.findByLabelText(/Claude Opus 5.5/)).toBeChecked()
    await user.click(screen.getByLabelText(/Claude Sonnet 5.5/))
    expect(apiCall).toHaveBeenCalledWith('admin.gameConfig', {
      model: 'claude-sonnet-5-5',
      id_token: TOKEN,
    })
    expect(await screen.findByLabelText(/Claude Sonnet 5.5/)).toBeChecked()
  })

  it('changes how often emails go out and sends a test email', async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/settings')
    expect(await screen.findByLabelText(/על כל סיפור/)).toBeChecked()
    await user.click(screen.getByLabelText(/סיכום יומי/))
    expect(apiCall).toHaveBeenCalledWith('admin.settingsUpdate', {
      notify_mode: 'daily',
      id_token: TOKEN,
    })
    expect(await screen.findByLabelText(/סיכום יומי/)).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'שליחת מייל בדיקה' }))
    expect(await screen.findByText(/נשלח אל/)).toHaveTextContent('owner@example.test')
  })

  it('backs up now and shows when', async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/settings')
    expect(await screen.findByText(/עוד לא נעשה גיבוי/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'גיבוי עכשיו' }))
    expect(await screen.findByText('הגיבוי נשמר בתיקיית הגיבויים.')).toBeInTheDocument()
    expect(screen.getByText(/גיבוי אחרון: 2 בדצמבר/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'לתיקיית הגיבויים' })).toHaveAttribute(
      'href',
      'https://drive/folder',
    )
  })

  it('publishes all the stories after confirming', async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/settings')
    await user.click(await screen.findByRole('button', { name: 'פרסם את כל הסיפורים' }))
    const dialog = screen.getByRole('dialog', { name: 'לפרסם את כל הסיפורים?' })
    await user.click(within(dialog).getByRole('button', { name: 'פרסום' }))
    expect(await screen.findByText(/נפתחו 3 מתוך 5 תמונות/)).toBeInTheDocument()
    expect(apiCall).toHaveBeenCalledWith('admin.setSiteStatus', {
      site_status: 'published',
      id_token: TOKEN,
    })
    expect(screen.getByRole('button', { name: 'החזרה לשלב האיסוף' })).toBeInTheDocument()
  })

  it('opens one story early', async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/story/st_aaaaaa01')
    await user.click(await screen.findByRole('button', { name: 'פתיחה לקריאה כבר עכשיו' }))
    expect(apiCall).toHaveBeenCalledWith('admin.setVisibility', {
      id: 'st_aaaaaa01',
      visibility: 'early',
      id_token: TOKEN,
    })
  })

  it('edits the text', async () => {
    window.sessionStorage.setItem('tamar70.adminToken', TOKEN)
    renderAt('/admin/story/st_aaaaaa01')
    await user.click(await screen.findByRole('button', { name: 'עריכת הטקסט' }))
    const excerpt = screen.getByLabelText('הטיזר')
    await user.clear(excerpt)
    await user.type(excerpt, 'טיזר חדש')
    await user.click(screen.getByRole('button', { name: 'כמה מילים לתמר' }))
    await user.click(screen.getByRole('button', { name: 'שמירה' }))
    expect(await screen.findByText('נשמר.')).toBeInTheDocument()
    expect(apiCall).toHaveBeenCalledWith(
      'admin.storyUpdate',
      expect.objectContaining({
        id: 'st_aaaaaa01',
        excerpt: 'טיזר חדש',
        category_id: 'wishes',
        title: 'הטרמפ לאילת',
        id_token: TOKEN,
      }),
    )
  })
})
