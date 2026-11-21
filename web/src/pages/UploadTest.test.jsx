import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from '../routes.jsx'

describe('UploadTest page', () => {
  it('is ready to upload', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/_upload-test'] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('button', { name: 'העלאה' })).toBeEnabled()
    expect(screen.getByLabelText(/הוסיפו תמונות/)).toHaveAttribute('accept', 'image/*')
  })
})
