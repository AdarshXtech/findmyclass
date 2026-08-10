import { lazy, Suspense, useMemo, useState } from 'react'
import {
  HiOutlineLocationMarker,
  HiOutlinePlay,
  HiOutlineSearch,
  HiOutlineShieldCheck,
  HiOutlineViewGrid,
  HiOutlineX,
} from 'react-icons/hi'
import useGeolocation from '../../hooks/useGeolocation'
import {
  CAMPUS_LOCATIONS,
  destinationContext,
  searchCampusLocations,
} from '../../services/campusLocations'
import { getIndoorGuidance } from '../../services/campusRouting'
import { findCampusRoute } from '../../services/campusPathGraph'
import { CAMPUS_PATH_EDGES, CAMPUS_PATH_NODES } from '../../services/campusPaths'

const CampusMap = lazy(() => import('./CampusMap'))
const QUICK_DESTINATIONS = [
  ['Hostel', 'nbh-ab-block'],
  ['Canteen', 'stadium-canteen'],
  ['Auditorium', 'auditorium'],
  ['Library', 'central-library'],
]

function DestinationButton({ destination, onSelect }) {
  const context = destinationContext(destination)
  return (
    <button
      type="button"
      onClick={() => onSelect(destination)}
      className="min-h-11 w-full rounded-lg border border-border-default bg-surface-primary px-3 py-3 text-left transition-colors hover:border-result-slate"
    >
      <span className="block font-bold [overflow-wrap:anywhere]">{destination.name}</span>
      <span className="mt-1 block text-xs text-text-secondary [overflow-wrap:anywhere]">
        {context || `${destination.category} · Coordinates not surveyed`}
      </span>
    </button>
  )
}

function RouteSummary({ route, start, destination }) {
  const minutes = Math.max(1, Math.ceil(route.distanceMeters / 80))
  return (
    <div className="border-l-4 border-result-slate-soft pl-3">
      <p className="text-sm text-text-secondary">From <strong className="text-text-primary">{start.name}</strong> to <strong className="text-text-primary">{destination.name}</strong></p>
      <p className="mt-2 font-bold">About {Math.round(route.distanceMeters)} m · {minutes} min walk</p>
      <p className="mt-1 text-sm text-text-secondary">{route.kind === 'network' ? 'Campus walking path available.' : 'Direct-line guidance only; this path has not been fully surveyed.'}</p>
    </div>
  )
}

export default function CampusMapView() {
  const [query, setQuery] = useState('')
  const [selectedDestination, setSelectedDestination] = useState(null)
  const [startMode, setStartMode] = useState('')
  const [manualStartId, setManualStartId] = useState('')
  const [pathMode, setPathMode] = useState('idle')
  const [recenterToken, setRecenterToken] = useState(0)
  const [mapFocus, setMapFocus] = useState('campus')
  const geolocation = useGeolocation()
  const searchResults = useMemo(
    () => searchCampusLocations(query, CAMPUS_LOCATIONS).slice(0, 8),
    [query],
  )
  const manualLocations = CAMPUS_LOCATIONS.filter((location) => location.coordinates)
  const manualStart = manualLocations.find((location) => location.id === manualStartId) || null
  const start = startMode === 'gps' && geolocation.position
    ? { id: 'current-location', name: 'Your current location', ...geolocation.position }
    : startMode === 'manual'
      ? manualStart
      : null
  const sameLocation = Boolean(start?.id && start.id === selectedDestination?.id)
  const calculatedRoute = useMemo(
    () => sameLocation ? null : findCampusRoute(start, selectedDestination, CAMPUS_PATH_NODES, CAMPUS_PATH_EDGES),
    [sameLocation, selectedDestination, start],
  )
  const routeState = !selectedDestination
    ? 'idle'
    : !start
      ? 'destination_selected'
      : sameLocation || !calculatedRoute
        ? 'route_error'
        : pathMode === 'active'
          ? 'path_active'
          : pathMode === 'cancelled'
            ? 'path_cancelled'
            : 'start_selected'
  const routeForMap = ['start_selected', 'path_active', 'path_cancelled'].includes(routeState) ? calculatedRoute : null
  const indoorSteps = selectedDestination ? getIndoorGuidance(selectedDestination) : []

  const selectDestination = (destination) => {
    geolocation.stop()
    setSelectedDestination(destination)
    setStartMode('')
    setManualStartId('')
    setPathMode('idle')
    setQuery('')
    setMapFocus('selection')
    setRecenterToken((value) => value + 1)
  }

  const chooseCurrentLocation = () => {
    setStartMode('gps')
    setManualStartId('')
    setPathMode('idle')
    geolocation.start()
  }

  const chooseManualStart = (value) => {
    geolocation.stop()
    setManualStartId(value)
    setStartMode(value ? 'manual' : '')
    setPathMode('idle')
    setMapFocus(value ? 'selection' : 'campus')
  }

  return (
    <section className="min-w-0" aria-labelledby="campus-map-title">
      <div className="mb-5">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-accent-primary">BBDU campus</p>
        <h1 id="campus-map-title" className="mt-2 font-display text-3xl font-bold sm:text-4xl">Map</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Choose a campus destination, select where you are starting, then start the path when you are ready.</p>
      </div>

      <div className="campus-map-layout grid min-w-0 gap-4 xl:grid-cols-[340px_minmax(0,1fr)] xl:items-start">
        <div className="campus-map-sidebar min-w-0 space-y-4 xl:sticky xl:top-8">
          <div className="campus-map-search min-w-0 rounded-lg border border-border-default bg-surface-primary p-4">
            <label htmlFor="campus-destination-search" className="text-sm font-bold">Search destination</label>
            <div className="relative mt-2">
              <HiOutlineSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-text-secondary" />
              <input
                id="campus-destination-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Where do you want to go?"
                className="h-12 w-full rounded-lg border border-border-input bg-surface-primary pl-10 pr-3 outline-none focus:border-focus focus:ring-2 focus:ring-focus-soft"
              />
            </div>
            {query ? (
              <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto" aria-live="polite">
                {searchResults.length ? searchResults.map((destination) => (
                  <DestinationButton key={destination.id} destination={destination} onSelect={selectDestination} />
                )) : <p className="py-3 text-sm text-text-secondary">No campus destination matches that search.</p>}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Quick destinations">
              {QUICK_DESTINATIONS.map(([label, id]) => {
                const destination = CAMPUS_LOCATIONS.find((location) => location.id === id)
                return <button key={id} type="button" onClick={() => selectDestination(destination)} className="min-h-11 rounded-lg border border-border-default px-3 py-2 text-sm font-bold hover:border-result-slate">{label}</button>
              })}
            </div>
          </div>

          {selectedDestination ? (
            <article className="campus-map-details min-w-0 rounded-lg border border-border-default bg-surface-primary p-5" aria-live="polite">
              <p className="font-mono text-xs font-bold uppercase tracking-wide text-accent-primary">Selected destination</p>
              <h2 className="mt-2 font-display text-2xl font-bold [overflow-wrap:anywhere]">{selectedDestination.name}</h2>
              <p className="mt-2 text-sm text-text-secondary">{destinationContext(selectedDestination) || `${selectedDestination.category} · Exact coordinates not surveyed`}</p>

              <div className="mt-5 border-t border-border-default pt-5">
                <h3 className="font-bold">Choose your starting point</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">Your location is used only to choose your starting point and guide you on campus.</p>
                <button
                  type="button"
                  onClick={chooseCurrentLocation}
                  disabled={geolocation.status === 'loading' || geolocation.status === 'denied'}
                  className="mt-3 min-h-11 w-full rounded-lg border border-result-slate px-4 py-2 font-bold text-result-slate-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {geolocation.status === 'loading' ? 'Finding your location...' : 'Use my current location'}
                </button>
                {geolocation.message ? <p className="mt-3 text-sm leading-6 text-text-secondary" role="status">{geolocation.message}</p> : null}
                <label htmlFor="manual-start" className="mt-4 block text-sm font-bold">Choose starting point manually</label>
                <select id="manual-start" value={manualStartId} onChange={(event) => chooseManualStart(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-border-input bg-surface-primary px-3">
                  <option value="">Select a verified location</option>
                  {manualLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </div>

              <div className="mt-5 border-t border-border-default pt-5">
                {!start ? <p className="text-sm font-semibold text-text-secondary">Choose a starting point to continue.</p> : null}
                {sameLocation ? <p role="alert" className="text-sm font-semibold text-status-danger">Starting point and destination are the same.</p> : null}
                {start && !sameLocation && !calculatedRoute ? <p role="alert" className="text-sm font-semibold text-status-danger">No valid path found between these locations.</p> : null}
                {calculatedRoute ? <RouteSummary route={calculatedRoute} start={start} destination={selectedDestination} /> : null}

                {routeState === 'start_selected' || routeState === 'path_cancelled' ? (
                  <button type="button" onClick={() => setPathMode('active')} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-result-slate px-4 py-3 font-bold text-white">
                    <HiOutlinePlay aria-hidden="true" className="text-xl" />Start Path
                  </button>
                ) : null}

                {routeState === 'path_active' ? (
                  <div className="mt-5">
                    <p className="font-mono text-xs font-bold uppercase tracking-wide text-result-slate-dark">Path started</p>
                    <ol className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
                      {calculatedRoute.steps.map((step, index) => <li key={`${step}-${index}`}>{index + 1}. {step}</li>)}
                    </ol>
                    {indoorSteps.length ? (
                      <div className="mt-4 border-t border-border-default pt-4">
                        <h3 className="font-bold">Indoor guidance</h3>
                        <ol className="mt-2 space-y-2 text-sm leading-6 text-text-secondary">{indoorSteps.map((step) => <li key={step}>{step}</li>)}</ol>
                      </div>
                    ) : null}
                    <button type="button" onClick={() => setPathMode('cancelled')} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-result-wine-soft px-4 py-3 font-bold text-accent-primary">
                      <HiOutlineX aria-hidden="true" className="text-xl" />Cancel Path
                    </button>
                  </div>
                ) : null}
                {routeState === 'path_cancelled' ? <p role="status" className="mt-3 text-sm text-text-secondary">Path cancelled. The preview remains available.</p> : null}
              </div>
            </article>
          ) : null}
        </div>

        <div className="campus-map-main min-w-0">
          <div className="campus-map-canvas relative min-w-0">
            <Suspense fallback={<div className="flex min-h-[420px] items-center justify-center rounded-lg border border-border-default bg-surface-muted" role="status">Loading campus map...</div>}>
              <CampusMap destination={selectedDestination} focus={mapFocus} locations={CAMPUS_LOCATIONS} position={start} recenterToken={recenterToken} route={routeForMap} routeMode={routeState === 'path_active' ? 'active' : 'preview'} />
            </Suspense>
            <div className="absolute bottom-7 right-3 z-[600] flex flex-col items-end gap-2 sm:bottom-4 sm:right-4 sm:flex-row">
              <button type="button" onClick={() => { setMapFocus('campus'); setRecenterToken((value) => value + 1) }} className="flex min-h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface-primary px-3 py-2 font-bold shadow-result">
                <HiOutlineViewGrid aria-hidden="true" className="text-xl text-result-slate" /> Campus
              </button>
              {selectedDestination || startMode === 'gps' ? (
                <button type="button" onClick={() => { setMapFocus('selection'); setRecenterToken((value) => value + 1) }} className="flex min-h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface-primary px-3 py-2 font-bold shadow-result">
                  <HiOutlineLocationMarker aria-hidden="true" className="text-xl text-result-slate" /> Recenter
                </button>
              ) : null}
            </div>
          </div>
          {!selectedDestination ? (
            <div className="mt-4 rounded-lg border border-border-default bg-surface-primary px-5 py-7 text-center">
              <HiOutlineLocationMarker aria-hidden="true" className="mx-auto text-3xl text-result-slate" />
              <h2 className="mt-3 font-display text-xl font-bold">Choose a destination</h2>
              <p className="mt-2 text-sm text-text-secondary">Search for a campus building or facility. No path starts automatically.</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
