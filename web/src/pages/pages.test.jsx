import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api/client.js'
import { createQueryClient } from '../api/queries.js'
import { routes } from '../routes.jsx'
import { bootstrap, teaser } from '../test/fixtures.js'

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
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-12-03T10:00:00Z') })
  vi.spyOn(api, 'bootstrap').mockResolvedValue(bootstrap())
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Home', () => {
  it('shows the countdown, the counter, the corners and sealed memories', async () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'תמר בת 70' })).toBeInTheDocument()
    expect(await screen.findByText(/כבר נאספו/)).toHaveTextContent('כבר נאספו 2 זיכרונות מ-2 אנשים')
    expect(screen.getByLabelText('הזמן שנשאר עד יום ההולדת')).toHaveTextContent('ימים65שעות12דקות0')
    expect(screen.getByText(/ייחשף ב-7 בפברואר/)).toBeInTheDocument()

    const corners = within(screen.getByRole('region', { name: 'הפינות' })).getAllByRole('link')
    expect(corners.map((a) => a.textContent)).toHaveLength(7) // "general" isn't a postcard
    expect(corners[6]).toHaveAttribute('href', '/corner/wishes')

    const feed = screen.getByRole('region', { name: 'זיכרונות אחרונים' })
    expect(within(feed).getByRole('link', { name: 'הטרמפ לאילת' })).toHaveAttribute(
      'href',
      '/story/st_aaaaaa01',
    )
    expect(within(feed).getByText('זיכרון מדני')).toBeInTheDocument() // no title
    expect(within(feed).getByText('3 תמונות מצורפות')).toBeInTheDocument()
    expect(within(feed).getAllByText('הסיפור המלא ייחשף בקרוב')).toHaveLength(2)
    expect(within(feed).getByText('ענת, חברה מהצבא · טיולים בארץ ובעולם')).toBeInTheDocument()
  })

  it('invites the first memory when there are none', async () => {
    api.bootstrap.mockResolvedValue(
      bootstrap({ stories: [], site: { ...bootstrap().site, stats: { stories: 0 } } }),
    )
    renderAt('/')
    expect(await screen.findByText('היו הראשונים לשתף זיכרון')).toBeInTheDocument()
    expect(screen.getByText(/הזיכרון הראשון יכול להיות שלכם/)).toBeInTheDocument()
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
    expect(screen.getByRole('link', { name: 'הוסיפו זיכרון לפינה הזו' })).toHaveAttribute(
      'href',
      '/add?corner=travels',
    )
    expect(screen.getByText('הטרמפ לאילת')).toBeInTheDocument()
    expect(screen.queryByText('זיכרון מדני')).not.toBeInTheDocument()
  })

  it('says so when a corner is empty or unknown', async () => {
    renderAt('/corner/protest')
    expect(await screen.findByText(/עוד אין זיכרונות בפינה הזו/)).toBeInTheDocument()
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

  it('shows the whole story once the server sends it', async () => {
    api.bootstrap.mockResolvedValue(
      bootstrap({ stories: [teaser({ view: 'full', content: 'כל הסיפור\nבשתי שורות' })] }),
    )
    renderAt('/story/st_aaaaaa01')
    expect(await screen.findByText(/כל הסיפור/)).toBeInTheDocument()
    expect(screen.queryByText('הסיפור המלא ייחשף בקרוב')).not.toBeInTheDocument()
  })

  it('handles a memory that is not there', async () => {
    vi.spyOn(api, 'story').mockRejectedValue(new ApiError('not_found', 'nope'))
    renderAt('/story/st_missing00')
    expect(await screen.findByText('הזיכרון הזה לא נמצא.')).toBeInTheDocument()
  })
})

describe('Gallery', () => {
  it('shows only the photo count while collecting', async () => {
    renderAt('/gallery')
    expect(await screen.findByText(/כבר נאספו 3 תמונות/)).toBeInTheDocument()
  })
})
