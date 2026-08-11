import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import NextClassHero from '../components/timetable/NextClassHero'
import { makeEntry, makeLookupData, setViewport } from '../test/fixtures'
import ResultPage from './ResultPage'

vi.mock('../components/map/CampusMapView', () => ({
  default: () => <h1>Campus Map View</h1>,
}))

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
    const mobileMenu = document.getElementById('schedule-menu')
    expect(within(mobileMenu).getByRole('button', { name: 'Daily Classes' })).toBeVisible()
    expect(within(mobileMenu).getByRole('button', { name: 'Weekly Classes' })).toBeVisible()
    expect(within(mobileMenu).getByRole('button', { name: 'Map' })).toBeVisible()
    expect(within(mobileMenu).getByRole('button', { name: 'Faculty' })).toBeVisible()

    await user.keyboard('{Escape}')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton).toHaveFocus()
  })

  it('keeps the class list collapsed until the student opens it', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 20, 7, 30))
    renderResultPage(makeLookupData({
      timetable: [makeEntry({ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' })],
    }))

    expect(screen.getByRole('button', { name: /other classes/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the end-of-day state after the final class', () => {
    render(<NextClassHero entry={null} status={null} finishedForToday />)

    expect(screen.getByText('No more classes today')).toBeVisible()
  })

  it('uses the softer next-class hero state without changing its content', () => {
    render(<NextClassHero entry={makeEntry()} status="Next class" timeContext="Starts at 9:00 AM" />)

    const hero = screen.getByRole('region', { name: 'Next class location' })
    expect(hero).toHaveClass('current-class-hero--next')
    expect(hero).toHaveTextContent('Digital Logic Design')
    expect(hero).toHaveTextContent('Room 407')
  })

  it('never displays a student full phone number', () => {
    renderResultPage()

    expect(document.body).not.toHaveTextContent('8429479825')
  })

  it('shows the published class coordinator in the student context', () => {
    renderResultPage()

    expect(screen.getByText('Class Coordinator')).toBeVisible()
    expect(screen.getByText('Ms. Jyoti Yadav')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Call class coordinator Ms. Jyoti Yadav' })).toHaveAttribute('href', 'tel:9876543210')
  })

  it.each([
    [320, 'small mobile'],
    [360, 'compact mobile'],
    [390, 'standard mobile'],
    [430, 'large mobile'],
    [768, 'tablet'],
    [1024, 'small desktop'],
    [1280, 'desktop'],
    [1440, 'large desktop'],
    [1920, 'wide desktop'],
  ])('keeps primary timetable interactions available at %ipx (%s)', async (width) => {
    const user = userEvent.setup()
    setViewport(width)
    renderResultPage()

    const menuButton = screen.getByRole('button', { name: 'Open schedule menu' })
    expect(menuButton).toBeVisible()
    expect(screen.getByRole('button', { name: /other classes/i })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Search again' })).toBeVisible()
    await user.click(menuButton)
    expect(within(document.getElementById('schedule-menu')).getByRole('button', { name: 'Weekly Classes' })).toBeVisible()
  })

  it('switches to weekly classes and closes the mobile menu', async () => {
    const user = userEvent.setup()
    renderResultPage()
    await user.click(screen.getByRole('button', { name: 'Open schedule menu' }))
    await user.click(within(document.getElementById('schedule-menu')).getByRole('button', { name: 'Weekly Classes' }))

    expect(screen.getByRole('button', { name: 'Open schedule menu' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('heading', { name: 'Weekly Classes' })).toBeVisible()
    expect(screen.getByRole('button', { name: /monday/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens Map from the student navigation and closes the mobile menu', async () => {
    const user = userEvent.setup()
    renderResultPage()
    await user.click(screen.getByRole('button', { name: 'Open schedule menu' }))
    await user.click(within(document.getElementById('schedule-menu')).getByRole('button', { name: 'Map' }))

    expect(screen.getByRole('button', { name: 'Open schedule menu' })).toHaveAttribute('aria-expanded', 'false')
    expect(await screen.findByRole('heading', { name: 'Campus Map View' })).toBeVisible()
  })

  it('shows class-specific faculty contacts with the coordinator first', async () => {
    const user = userEvent.setup()
    renderResultPage()
    await user.click(screen.getByRole('button', { name: 'Open schedule menu' }))
    await user.click(within(document.getElementById('schedule-menu')).getByRole('button', { name: 'Faculty' }))

    expect(screen.getByRole('button', { name: 'Open schedule menu' })).toHaveAttribute('aria-expanded', 'false')
    expect(await screen.findByRole('heading', { name: 'Faculty' })).toBeVisible()
    expect(screen.getAllByText('Class Coordinator')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Call Ms. Jyoti Yadav' })).toHaveAttribute('href', 'tel:9876543210')
    expect(screen.getByText('Dr. Pooja Verma')).toBeVisible()
  })

  it('shows faculty empty states without inventing contacts', async () => {
    const user = userEvent.setup()
    renderResultPage(makeLookupData({ facultyContacts: [] }))
    await user.click(screen.getByRole('button', { name: 'Open schedule menu' }))
    await user.click(within(document.getElementById('schedule-menu')).getByRole('button', { name: 'Faculty' }))

    expect(await screen.findByText('Coordinator information has not been added yet.')).toBeVisible()
    expect(screen.getByText('No faculty names are listed in this class timetable.')).toBeVisible()
  })
})
