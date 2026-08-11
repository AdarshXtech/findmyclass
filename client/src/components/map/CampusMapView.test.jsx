import { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampusMapView from './CampusMapView'

const geolocation = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }))

vi.mock('./CampusMap', () => ({
  default: ({ route, routeMode }) => <div data-testid="campus-map" data-route={route?.kind || 'none'} data-route-mode={route ? routeMode : 'none'}>Interactive map</div>,
}))

vi.mock('../../hooks/useGeolocation', () => ({
  default: () => ({ message: '', position: null, start: geolocation.start, status: 'idle', stop: geolocation.stop }),
}))

function renderMap() {
  return render(
    <Suspense>
      <CampusMapView />
    </Suspense>,
  )
}

async function selectAccountsOffice(user) {
  await user.type(screen.getByLabelText('Search destination'), 'ITM')
  await user.click(screen.getByRole('button', { name: /Accounts Office/ }))
}

describe('CampusMapView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens without requesting location or starting a route', async () => {
    renderMap()

    expect(await screen.findByTestId('campus-map')).toHaveAttribute('data-route', 'none')
    expect(geolocation.start).not.toHaveBeenCalled()
    expect(screen.queryByText('Next class')).not.toBeInTheDocument()
    expect(screen.getByText(/Choose a campus destination/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Canteen' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Start Path' })).not.toBeInTheDocument()
  })

  it('selects a quick destination without starting a path', async () => {
    const user = userEvent.setup()
    renderMap()

    await user.click(screen.getByRole('button', { name: 'Canteen' }))
    expect(screen.getByRole('heading', { name: 'Stadium Canteen' })).toBeVisible()
    expect(screen.getByText('Choose your starting point')).toBeVisible()
    expect(screen.getByTestId('campus-map')).toHaveAttribute('data-route', 'none')
    expect(geolocation.start).not.toHaveBeenCalled()
  })

  it('shows a preview after manual start selection and activates only on Start Path', async () => {
    const user = userEvent.setup()
    renderMap()
    await selectAccountsOffice(user)

    await user.selectOptions(screen.getByLabelText('Choose starting point manually'), 'central-library')
    expect(screen.getByTestId('campus-map')).toHaveAttribute('data-route-mode', 'preview')
    expect(screen.getByRole('button', { name: 'Start Path' })).toBeEnabled()
    expect(screen.queryByText('Path started')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start Path' }))
    expect(screen.getByTestId('campus-map')).toHaveAttribute('data-route-mode', 'active')
    expect(screen.getByText('Path started')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cancel Path' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Cancel Path' }))
    expect(screen.getByTestId('campus-map')).toHaveAttribute('data-route-mode', 'preview')
    expect(screen.getByText(/Path cancelled/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Start Path' })).toBeVisible()
  })

  it('removes the displayed path without clearing the destination', async () => {
    const user = userEvent.setup()
    renderMap()
    await selectAccountsOffice(user)
    await user.selectOptions(screen.getByLabelText('Choose starting point manually'), 'central-library')

    expect(screen.getByRole('button', { name: 'Remove Path' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Remove Path' }))

    expect(screen.getByTestId('campus-map')).toHaveAttribute('data-route', 'none')
    expect(screen.getByRole('heading', { name: 'Accounts Office' })).toBeVisible()
    expect(screen.getByText('Choose a starting point to continue.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Remove Path' })).not.toBeInTheDocument()
  })

  it('requests location only after the user chooses current location', async () => {
    const user = userEvent.setup()
    renderMap()
    await selectAccountsOffice(user)

    expect(geolocation.start).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Use my current location' }))
    expect(geolocation.start).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('campus-map')).toHaveAttribute('data-route', 'none')
  })

  it('blocks a route when start and destination are the same', async () => {
    const user = userEvent.setup()
    renderMap()
    await selectAccountsOffice(user)

    await user.selectOptions(screen.getByLabelText('Choose starting point manually'), 'itm')
    expect(screen.getByRole('alert')).toHaveTextContent('Starting point and destination are the same.')
    expect(screen.queryByRole('button', { name: 'Start Path' })).not.toBeInTheDocument()
    expect(screen.getByTestId('campus-map')).toHaveAttribute('data-route', 'none')
  })

  it('does not expose timetable classes or rooms in map search', async () => {
    const user = userEvent.setup()
    renderMap()

    await user.type(screen.getByLabelText('Search destination'), '407')
    expect(screen.getByText('No campus destination matches that search.')).toBeVisible()
    await user.clear(screen.getByLabelText('Search destination'))
    await user.type(screen.getByLabelText('Search destination'), '414')
    expect(screen.getByText('No campus destination matches that search.')).toBeVisible()
  })

  it('shows an error when a selected destination has no surveyed coordinates', async () => {
    const user = userEvent.setup()
    renderMap()

    await user.type(screen.getByLabelText('Search destination'), 'Academic Block I')
    await user.click(screen.getAllByRole('button', { name: /Academic Block I/ })[0])
    await user.selectOptions(screen.getByLabelText('Choose starting point manually'), 'central-library')
    expect(screen.getByRole('alert')).toHaveTextContent('No valid path found between these locations.')
    expect(screen.queryByRole('button', { name: 'Start Path' })).not.toBeInTheDocument()
  })
})
