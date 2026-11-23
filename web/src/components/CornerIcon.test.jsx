import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CornerIcon } from './CornerIcon.jsx'

const drawing = (id) => render(<CornerIcon id={id} />).container.querySelector('svg').innerHTML

describe('CornerIcon', () => {
  it('draws a different icon for each corner', () => {
    const ids = [
      'journey',
      'protest',
      'travels',
      'sayings',
      'culture',
      'did-you-know',
      'wishes',
      'general',
    ]
    expect(new Set(ids.map(drawing)).size).toBe(ids.length)
  })

  it('gives a corner added later the general icon', () => {
    expect(drawing('new-corner')).toBe(drawing('general'))
  })

  it('is decorative and takes its color from the tone', () => {
    const svg = render(<CornerIcon id="journey" />).container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
  })
})
