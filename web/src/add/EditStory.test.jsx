import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api/client.js'
import { createQueryClient } from '../api/queries.js'
import { readStored, writeStored } from '../lib/storage.js'
import { routes } from '../routes.jsx'
import { bootstrap } from '../test/fixtures.js'
import { uploadPhoto } from '../upload/uploadPhoto.js'

vi.mock('../upload/uploadPhoto.js', async (original) => ({
  ...(await original()),
  uploadPhoto: vi.fn(),
}))

const user = userEvent.setup({ applyAccept: false })
const ID = 'st_mine00001'
const TOKEN = 'a'.repeat(43)

const own = {
  id: ID,
  kind: 'mixed',
  author_name: 'דנה',
  author_relation: 'אחיינית',
  title: 'הטיול לגליל',
  content: 'היה פעם טיול',
  category_id: 'trips',
  decade: null,
  places: ['גליל'],
  people: [],
  photos: [
    {
      id: 'md_1',
      filename: 'a.jpg',
      caption: 'בדרך',
      year_approx: 1985,
      people: [],
      thumbnail: 'data:image/png;base64,AAA',
    },
  ],
}

function renderEdit() {
  const router = createMemoryRouter(routes, { initialEntries: [`/edit/${ID}`] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  window.localStorage.clear()
  writeStored('mine', { [ID]: { token: TOKEN, created_at: '2026-11-20T10:00:00Z' } })
  vi.spyOn(api, 'bootstrap').mockResolvedValue(bootstrap())
  vi.spyOn(api, 'getOwn').mockResolvedValue(own)
  vi.spyOn(api, 'updateOwn').mockResolvedValue({ id: ID })
  vi.spyOn(api, 'deleteOwn').mockResolvedValue({ id: ID })
  vi.spyOn(api, 'updateOwnPhoto').mockResolvedValue({})
  vi.spyOn(api, 'removeOwnPhoto').mockResolvedValue({})
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:photo')
  HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close ??= function () {
    this.open = false
  }
  uploadPhoto.mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('editing a story', () => {
  it('only works from the device that sent it', async () => {
    window.localStorage.clear()
    renderEdit()
    expect(await screen.findByText('אי אפשר לערוך מכאן')).toBeInTheDocument()
    expect(api.getOwn).not.toHaveBeenCalled()
  })

  it('loads the story with the device token', async () => {
    renderEdit()
    expect(await screen.findByDisplayValue('הטיול לגליל')).toBeInTheDocument()
    expect(api.getOwn).toHaveBeenCalledWith({ id: ID, edit_token: TOKEN })
    expect(screen.getByLabelText('השם שלכם')).toHaveValue('דנה')
  })

  it('saves changed text', async () => {
    renderEdit()
    const title = await screen.findByDisplayValue('הטיול לגליל')
    await user.clear(title)
    await user.type(title, 'טיול אחר')
    await user.click(screen.getByRole('button', { name: 'שמירת השינויים' }))
    expect(await screen.findByText('השינויים נשמרו')).toBeInTheDocument()
    expect(api.updateOwn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ID,
        edit_token: TOKEN,
        title: 'טיול אחר',
        content: 'היה פעם טיול',
        places: ['גליל'],
      }),
    )
    expect(api.removeOwnPhoto).not.toHaveBeenCalled()
    expect(uploadPhoto).not.toHaveBeenCalled()
  })

  it('removes an existing photo and uploads a new one', async () => {
    uploadPhoto.mockResolvedValue({})
    renderEdit()
    await screen.findByDisplayValue('הטיול לגליל')
    await user.click(screen.getByRole('button', { name: /a\.jpg/ }))
    await user.click(screen.getByRole('button', { name: 'הסרת התמונה' }))
    await user.upload(
      document.querySelector('input[type=file]'),
      new File([new Uint8Array(100)], 'b.jpg', { type: 'image/jpeg' }),
    )
    await user.click(screen.getByRole('button', { name: 'שמירת השינויים' }))
    expect(await screen.findByText('השינויים נשמרו')).toBeInTheDocument()
    expect(api.removeOwnPhoto).toHaveBeenCalledWith({
      story_id: ID,
      edit_token: TOKEN,
      media_id: 'md_1',
    })
    expect(uploadPhoto).toHaveBeenCalledTimes(1)
    expect(uploadPhoto.mock.calls[0][0]).toMatchObject({ storyId: ID, editToken: TOKEN })
  })

  it('deletes the story after confirming, and forgets it', async () => {
    renderEdit()
    await screen.findByDisplayValue('הטיול לגליל')
    await user.click(screen.getByRole('button', { name: 'מחיקת הסיפור' }))
    await user.click(screen.getByRole('button', { name: 'מחיקה' }))
    expect(await screen.findByText('הסיפור נמחק')).toBeInTheDocument()
    expect(api.deleteOwn).toHaveBeenCalledWith({ id: ID, edit_token: TOKEN })
    expect(readStored('mine', {})).toEqual({})
  })

  it('explains when the stories were already revealed', async () => {
    api.getOwn.mockRejectedValue(new ApiError('editing_closed', 'closed'))
    renderEdit()
    expect(await screen.findByText('אי אפשר לערוך את הסיפור')).toBeInTheDocument()
  })
})
