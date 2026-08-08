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
    expect(card.querySelector('.schedule-card__time')).toBeInTheDocument()
    expect(card.querySelector('.schedule-card__room')).toHaveTextContent('Room 407')
    expect(card.querySelector('.schedule-card__location-meta')).toHaveTextContent('Floor 4')
  })

  it('communicates a cancelled class with text as well as colour', () => {
    render(<ClassCard entry={makeEntry({ status: 'cancelled' })} />)

    expect(screen.getByRole('article', { name: /cancelled/i })).toHaveTextContent('Cancelled')
    expect(screen.getByText('Room 407')).toBeVisible()
  })

  it('keeps the LGF lab name, floor, wing, and room visible', () => {
    render(<ClassCard entry={makeEntry({
      room: 'LGF001',
      classroomNumber: 'LGF001',
      floor: 'Lower Ground Floor',
      floorLabel: 'Lower Ground Floor',
      shortFloor: 'LGF',
      wing: 'A',
      locationName: 'DLD Lab',
    })} />)

    expect(screen.getByText('DLD Lab')).toBeVisible()
    expect(screen.getByText('Lower Ground Floor · Wing A · Room LGF001')).toBeVisible()
  })
})
