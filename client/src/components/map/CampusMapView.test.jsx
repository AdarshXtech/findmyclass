import { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../../test/fixtures'
import CampusMapView from './CampusMapView'

vi.mock('./CampusMap', () => ({
  default: () => <div data-testid="campus-map">Interactive map</div>,
}))

vi.mock('../../hooks/useGeolocation', () => ({
  default: () => ({ message: '', position: null, start: vi.fn(), status: 'idle', stop: vi.fn() }),
}))

function renderMap(props = {}) {
  const entry = makeEntry({ floorLabel: 'Floor 4', wing: 'A' })
  return render(
    <Suspense>
      <CampusMapView priorityEntry={entry} locationStatus="Next class" timetable={[entry]} {...props} />
    </Suspense>,
  )
}

describe('CampusMapView', () => {
  it('shows the real map surface, next class, privacy copy, and manual start', async () => {
    renderMap()

    expect(await screen.findByTestId('campus-map')).toBeVisible()
    expect(screen.getByText('Next class')).toBeVisible()
    expect(screen.getByText(/not stored or attached/i)).toBeVisible()
    expect(screen.getByLabelText('Choose starting point')).toBeVisible()
    expect(screen.queryByText('Quick destinations')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Campus' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Recenter' })).toBeVisible()
  })

  it('searches timetable rooms and selects a result with keyboard-accessible controls', async () => {
    const user = userEvent.setup()
    renderMap()

    await user.type(screen.getByLabelText('Search destination'), '407')
    await user.click(screen.getByRole('button', { name: /Room 407/ }))
    expect(screen.getByRole('heading', { name: 'Room 407' })).toBeVisible()
  })

  it('explains when a campus destination still needs surveyed coordinates', async () => {
    const user = userEvent.setup()
    renderMap({ priorityEntry: null, locationStatus: null })

    await user.type(screen.getByLabelText('Search destination'), 'Academic Block I')
    await user.click(screen.getAllByRole('button', { name: /Academic Block I/ })[0])
    expect(screen.getByText(/directions unavailable until this location is surveyed/i)).toBeVisible()
  })

  it('shows the local straight-line fallback when the path network does not reach the destination', async () => {
    const user = userEvent.setup()
    renderMap()

    await user.selectOptions(screen.getByLabelText('Choose starting point'), 'central-library')
    expect(screen.getByText(/Direct line/)).toBeVisible()
    expect(screen.getByText(/surveyed walking path does not reach/i)).toBeVisible()
    expect(screen.queryByRole('link', { name: /walking directions/i })).not.toBeInTheDocument()
  })
})
