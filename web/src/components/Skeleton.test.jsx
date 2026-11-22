import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CornerTilesSkeleton, Skeleton, StoryFeedSkeleton } from './Skeleton.jsx'

describe('skeletons', () => {
  it('draws a shape from its size and width, hidden from screen readers', () => {
    const { container } = render(<Skeleton size="xl" width="2/3" center />)
    const el = container.firstChild
    expect(el.className).toMatch(/line/)
    expect(el.className).toMatch(/lineXl/)
    expect(el.className).toMatch(/w23/)
    expect(el.className).toMatch(/center/)
    expect(el).toHaveAttribute('aria-hidden', 'true')
  })

  it('announces a loading group once', () => {
    render(<StoryFeedSkeleton count={3} />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('makes the last corner wide when the count is odd, like the real grid', () => {
    const { container } = render(<CornerTilesSkeleton count={7} />)
    const tiles = container.querySelectorAll('[role=status] > div')
    expect(tiles).toHaveLength(7)
    expect(tiles[6].className).toMatch(/wide/)
    expect(tiles[5].className).not.toMatch(/wide/)
  })
})
