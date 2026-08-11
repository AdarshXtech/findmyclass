import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampusPathEditor from './CampusPathEditor'

const mapEvents = vi.hoisted(() => ({ current: null }))

vi.mock('react-leaflet', () => ({
  CircleMarker: ({ children }) => <div>{children}</div>,
  MapContainer: ({ children }) => <div>{children}</div>,
  Polyline: () => null,
  Popup: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  useMapEvents: (events) => { mapEvents.current = events },
}))

describe('CampusPathEditor', () => {
  beforeEach(() => {
    localStorage.clear()
    mapEvents.current = null
  })

  it('keeps the save button visible and stores path edits as a browser draft', async () => {
    render(<CampusPathEditor />)

    expect(screen.getByRole('button', { name: 'Save path file' })).toBeVisible()
    expect(screen.getByText(/Draft saved in this browser/)).toBeVisible()

    act(() => mapEvents.current.click({ latlng: { lat: 26.88, lng: 81.05 } }))

    await waitFor(() => {
      const draft = JSON.parse(localStorage.getItem('findmyclass-campus-path-draft'))
      expect(draft.nodes).toHaveLength(1)
      expect(draft.nodes[0].coordinates).toEqual([26.88, 81.05])
    })
  })
})
