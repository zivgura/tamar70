import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api/client.js'
import { createQueryClient } from '../api/queries.js'
import { LanguageProvider } from '../i18n/language.jsx'
import { routes } from '../routes.jsx'
import { bootstrap, teaser } from '../test/fixtures.js'

const PHOTO = {
  id: 'md_1',
  url: 'https://lh3.googleusercontent.com/d/f1=w1600',
  thumb: 'https://lh3.googleusercontent.com/d/f1=w600',
  caption: 'בצומת',
  year_approx: 1975,
  place: 'באר שבע',
  people: [],
}
const published = () => ({ ...bootstrap().site, site_status: 'published' })

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-12-03T10:00:00Z') })
  vi.spyOn(api, 'bootstrap').mockResolvedValue(bootstrap())
})
afterEach(() => {
  window.localStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Home', () => {
  it('shows the countdown, the counter, the corners and sealed memories', async () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'תמר בת 70' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /ציור של תמר/ })).toHaveAttribute('loading', 'eager')
    expect(await screen.findByText(/כבר נאספו/)).toHaveTextContent('כבר נאספו 2 סיפורים מ-2 אנשים')
    expect(screen.getByLabelText('הזמן שנשאר עד יום ההולדת')).toHaveTextContent('ימים65שעות12דקות0')
    expect(screen.getByText(/ייחשף ב-7 בפברואר/)).toBeInTheDocument()

    const corners = within(screen.getByRole('region', { name: 'הפינות' })).getAllByRole('link')
    expect(corners.map((a) => a.textContent)).toHaveLength(7) // "general" isn't a postcard
    expect(corners[6]).toHaveAttribute('href', '/corner/wishes')

    const feed = screen.getByRole('region', { name: 'סיפורים אחרונים' })
    expect(within(feed).getByRole('link', { name: 'הטרמפ לאילת' })).toHaveAttribute(
      'href',
      '/story/st_aaaaaa01',
    )
    expect(within(feed).getByText('סיפור מדני')).toBeInTheDocument() // no title
    expect(within(feed).getByText('3 תמונות מצורפות')).toBeInTheDocument()
    expect(within(feed).getAllByText('הסיפור המלא ייחשף בקרוב')).toHaveLength(2)
    expect(within(feed).getByText('ענת, חברה מהצבא · טיולים בארץ ובעולם')).toBeInTheDocument()
  })

  it('invites the first memory when there are none', async () => {
    api.bootstrap.mockResolvedValue(
      bootstrap({ stories: [], site: { ...bootstrap().site, stats: { stories: 0 } } }),
    )
    renderAt('/')
    expect(await screen.findByText('היו הראשונים לשתף סיפור')).toBeInTheDocument()
    expect(screen.getByText(/הסיפור הראשון יכול להיות שלכם/)).toBeInTheDocument()
  })

  it('offers a retry when the server can’t be reached', async () => {
    api.bootstrap.mockRejectedValueOnce(new ApiError('network', 'down'))
    renderAt('/')
    expect(await screen.findByRole('alert')).toHaveTextContent('אין חיבור כרגע')
    await userEvent.click(screen.getByRole('button', { name: 'נסו שוב' }))
    expect(await screen.findByText(/כבר נאספו/)).toBeInTheDocument()
  })
})

describe('Corner', () => {
  it('shows the prompt, a button for this corner and only its memories', async () => {
    renderAt('/corner/travels')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('טיולים בארץ ובעולם')
    expect(screen.getByText('שאלה על טיולים בארץ ובעולם')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'הוסיפו סיפור לפינה הזו' })).toHaveAttribute(
      'href',
      '/add?corner=travels',
    )
    expect(screen.getByText('הטרמפ לאילת')).toBeInTheDocument()
    expect(screen.queryByText('סיפור מדני')).not.toBeInTheDocument()
  })

  it('says so when a corner is empty or unknown', async () => {
    renderAt('/corner/protest')
    expect(await screen.findByText(/עוד אין סיפורים בפינה הזו/)).toBeInTheDocument()
  })

  it('handles a corner that does not exist', async () => {
    renderAt('/corner/nope')
    expect(await screen.findByText('הפינה הזו לא קיימת.')).toBeInTheDocument()
  })
})

describe('Story', () => {
  it('shows the sealed card and the reveal date', async () => {
    renderAt('/story/st_aaaaaa01')
    expect(await screen.findByRole('heading', { level: 1, name: 'הטרמפ לאילת' })).toBeVisible()
    expect(screen.getByText(/ייחשף ב-7 בפברואר/)).toBeInTheDocument()
  })

  it('after the reveal, loads the whole story with its photos', async () => {
    api.bootstrap.mockResolvedValue(
      bootstrap({ site: published(), stories: [teaser({ view: 'full', cover: PHOTO.thumb })] }),
    )
    vi.spyOn(api, 'story').mockResolvedValue(
      teaser({ view: 'full', content: 'כל הסיפור\nבשתי שורות', photos: [PHOTO] }),
    )
    renderAt('/story/st_aaaaaa01')
    expect(await screen.findByText(/כל הסיפור/)).toBeInTheDocument()
    expect(api.story).toHaveBeenCalledWith('st_aaaaaa01')
    expect(screen.queryByText('הסיפור המלא ייחשף בקרוב')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'שיתוף הסיפור' })).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'הגדלת התמונה: בצומת' }))
    const dialog = screen.getByRole('dialog', { name: 'תמונה' })
    expect(within(dialog).getByRole('img', { name: 'בצומת' })).toHaveAttribute('src', PHOTO.url)
    expect(within(dialog).getByText('1975 · באר שבע')).toBeInTheDocument()
  })

  it('handles a memory that is not there', async () => {
    vi.spyOn(api, 'story').mockRejectedValue(new ApiError('not_found', 'nope'))
    renderAt('/story/st_missing00')
    expect(await screen.findByText('הסיפור הזה לא נמצא.')).toBeInTheDocument()
  })
})

describe('Gallery', () => {
  it('shows only the photo count while collecting', async () => {
    renderAt('/gallery')
    expect(await screen.findByText(/כבר נאספו 3 תמונות/)).toBeInTheDocument()
  })

  it('shows every photo after the reveal, each linking to its story', async () => {
    api.bootstrap.mockResolvedValue(bootstrap({ site: published() }))
    vi.spyOn(api, 'gallery').mockResolvedValue({
      photos: [{ ...PHOTO, story_id: 'st_aaaaaa01', story_title: 'הטרמפ לאילת' }],
    })
    renderAt('/gallery')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'הגדלת התמונה: בצומת' }))
    expect(screen.getByRole('link', { name: 'לסיפור: הטרמפ לאילת' })).toHaveAttribute(
      'href',
      '/story/st_aaaaaa01',
    )
  })
})

describe('Home after the reveal', () => {
  it('swaps the countdown for the reveal message and the counts', async () => {
    api.bootstrap.mockResolvedValue(bootstrap({ site: published() }))
    renderAt('/')
    expect(await screen.findByText(/יום הולדת שמח, תמר!/)).toBeInTheDocument()
    expect(screen.queryByLabelText('הזמן שנשאר עד יום ההולדת')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'לכל התמונות' })).toHaveAttribute('href', '/gallery')
  })
})

describe('a page that crashes', () => {
  it('shows a way out instead of a blank screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api.bootstrap.mockResolvedValue({ ...bootstrap(), stories: [null] })
    renderAt('/')
    expect(await screen.findByText(/משהו השתבש בדף הזה/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'טעינה מחדש' })).toBeInTheDocument()
  })
})

describe('the English site', () => {
  it('switches to English and back, and remembers the choice', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await screen.findByText(/כבר נאספו/)
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')

    expect(screen.getByRole('button', { name: 'עברית' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { level: 1, name: 'Tamar turns 70' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(screen.getByText(/collected so far from/)).toHaveTextContent(
      '2 stories collected so far from 2 people',
    )
    expect(screen.getByLabelText('Time left until the birthday')).toHaveTextContent('days')
    expect(screen.getByText(/revealed on 7 February/)).toBeInTheDocument()
    // Texts from the Sheet when it has them, else the site's own English for its corners.
    const corners = within(screen.getByRole('region', { name: 'Corners' }))
    expect(corners.getByText('Trips in Israel and Abroad')).toBeInTheDocument()
    expect(corners.getByText('A Journey Through Time')).toBeInTheDocument()
    expect(window.localStorage.getItem('tamar70.lang')).toBe('en')

    await user.click(screen.getByRole('button', { name: 'עברית' }))
    expect(screen.getByRole('heading', { level: 1, name: 'תמר בת 70' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
  })

  it('opens in English when chosen before, with stories left in their own language', async () => {
    window.localStorage.setItem('tamar70.lang', 'en')
    renderAt('/corner/travels')
    expect(
      await screen.findByRole('heading', { name: 'Trips in Israel and Abroad' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Where did you travel together?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /All corners/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'הטרמפ לאילת' })).toHaveAttribute('dir', 'auto')
    expect(screen.getByText('The full story will be revealed soon')).toBeInTheDocument()
  })

  it('asks for the name in English in the add flow', async () => {
    window.localStorage.setItem('tamar70.lang', 'en')
    const user = userEvent.setup()
    renderAt('/add')
    await user.click(await screen.findByRole('button', { name: /Writing and photos/ }))
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Write your name')).toBeInTheDocument()
  })
})
