import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from './routes.jsx'

const renderAt = (path) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)

describe('App', () => {
  it('renders the styleguide with every category tone', async () => {
    renderAt('/_styleguide')
    expect(await screen.findByRole('heading', { name: 'מערכת העיצוב' })).toBeInTheDocument()
    for (const tone of ['rose', 'sage', 'terracotta', 'sand']) {
      expect(document.querySelector(`[data-tone="${tone}"]`)).not.toBeNull()
    }
  })
})
