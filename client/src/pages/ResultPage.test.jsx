import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import NextClassHero from '../components/timetable/NextClassHero'
import { makeEntry, makeLookupData, setViewport } from '../test/fixtures'
import ResultPage from './ResultPage'

function renderResultPage(data = makeLookupData()) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/result', state: { lookupData: data } }]}>
      <Routes>
        <Route path="/result" element={<ResultPage />} />
        <Route path="/" element={<p>Student search</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ResultPage', () => {
  it('opens the hamburger with the keyboard and restores focus after Escape', async () => {
    const user = userEvent.setup()
    renderResultPage()

    const menuButton = screen.getByRole('button', { name: 'Open schedule menu' })
    menuButton.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('button', { name: 'Close schedule menu' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Today Classes' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Weekly Classes' })).toBeVisible()

    await user.keyboard('{Escape}')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton).toHaveFocus()
  })

  it('auto-expands today when the first class is 90 minutes away', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 20, 7, 30))
    renderResultPage(makeLookupData({
      timetable: [makeEntry({ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' })],
    }))

    expect(screen.getByRole('button', { name: /today classes/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows the end-of-day state after the final class', () => {
    render(<NextClassHero entry={null} status={null} finishedForToday />)

    expect(screen.getByText('No more classes today')).toBeVisible()
  })

  it('never displays a student full phone number', () => {
    renderResultPage()

    expect(document.body).not.toHaveTextContent('8429479825')
  })

  it.each([
    [320, 'small mobile'],
    [390, 'standard mobile'],
    [768, 'tablet'],
    [1280, 'desktop'],
  ])('keeps primary timetable interactions available at %ipx (%s)', async (width) => {
    const user = userEvent.setup()
    setViewport(width)
    renderResultPage()

    const menuButton = screen.getByRole('button', { name: 'Open schedule menu' })
    expect(menuButton).toBeVisible()
    expect(screen.getByRole('button', { name: /today classes/i })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Search again' })).toBeVisible()
    await user.click(menuButton)
    expect(screen.getByRole('button', { name: 'Weekly Classes' })).toBeVisible()
  })
})
