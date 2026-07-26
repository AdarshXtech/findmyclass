import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeEntry } from '../../test/fixtures'
import ClassCard from './ClassCard'

describe('ClassCard', () => {
  it('keeps completed class details and location readable', () => {
    render(<ClassCard entry={makeEntry()} status="completed" />)

    const card = screen.getByRole('article', { name: /completed/i })
    expect(card).toHaveTextContent('Completed')
    expect(card).toHaveTextContent('Digital Logic Design')
    expect(card).toHaveTextContent('Mr. Vivek Singh')
    expect(card).toHaveTextContent('407')
    expect(card.className).not.toMatch(/opacity/)
  })
})
