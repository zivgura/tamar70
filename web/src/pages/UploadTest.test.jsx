import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from '../routes.jsx'

describe('UploadTest page', () => {
  it('takes the family code from the link', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/_upload-test?k=abc12345'] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByLabelText(/קוד משפחה/)).toHaveValue('abc12345')
    expect(screen.getByRole('button', { name: 'העלאה' })).toBeEnabled()
    expect(screen.getByLabelText(/הוסיפו תמונות/)).toHaveAttribute('accept', 'image/*')
  })
})
