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
    case 'admin.settings':
      return {
        notify_mode: 'each',
        recipients: ['owner@example.test'],
        housekeeping_ran_at: '2026-12-02T10:00:00Z',
      }
    case 'admin.settingsUpdate':
      return { notify_mode: payload.notify_mode, recipients: ['owner@example.test'] }
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
