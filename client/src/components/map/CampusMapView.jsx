import { lazy, Suspense, useMemo, useState } from 'react'
import {
  HiOutlineLocationMarker,
  HiOutlineSearch,
  HiOutlineShieldCheck,
  HiOutlineViewGrid,
} from 'react-icons/hi'
import useGeolocation from '../../hooks/useGeolocation'
import {
  buildTimetableDestinations,
  CAMPUS_LOCATIONS,
  destinationContext,
  destinationForEntry,
  searchCampusLocations,
} from '../../services/campusLocations'
import { getIndoorGuidance } from '../../services/campusRouting'
import { findCampusRoute } from '../../services/campusPathGraph'
import { CAMPUS_PATH_EDGES, CAMPUS_PATH_NODES } from '../../services/campusPaths'

const CampusMap = lazy(() => import('./CampusMap'))

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

export default function CampusMapView({ locationStatus, priorityEntry, timetable = [] }) {
  const timetableDestinations = useMemo(() => buildTimetableDestinations(timetable), [timetable])
  const locations = useMemo(() => [...timetableDestinations, ...CAMPUS_LOCATIONS], [timetableDestinations])
  const priorityDestination = useMemo(
    () => destinationForEntry(priorityEntry, timetableDestinations),
    [priorityEntry, timetableDestinations],
  )
  const [query, setQuery] = useState('')
  const [selectedDestination, setSelectedDestination] = useState(priorityDestination)
  const [manualStartId, setManualStartId] = useState('')
  const [recenterToken, setRecenterToken] = useState(0)
  const [mapFocus, setMapFocus] = useState('campus')
  const geolocation = useGeolocation()
  const searchResults = useMemo(
    () => searchCampusLocations(query, locations).slice(0, 8),
    [locations, query],
  )
  const manualLocations = CAMPUS_LOCATIONS.filter((location) => location.coordinates)
  const manualStart = manualLocations.find((location) => location.id === manualStartId) || null
  const start = geolocation.position
    ? { name: 'Your current location', coordinates: geolocation.position.coordinates }
    : manualStart
  const selectDestination = (destination) => {
    setSelectedDestination(destination)
    setQuery('')
    setMapFocus('selection')
    setRecenterToken((value) => value + 1)
  }

  const indoorSteps = selectedDestination ? getIndoorGuidance(selectedDestination) : []
  const route = useMemo(
    () => findCampusRoute(start, selectedDestination, CAMPUS_PATH_NODES, CAMPUS_PATH_EDGES),
    [selectedDestination, start],
  )

  return (
    <section className="min-w-0" aria-labelledby="campus-map-title">
      <div className="mb-5">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-accent-primary">BBDU campus</p>
        <h1 id="campus-map-title" className="mt-2 font-display text-3xl font-bold sm:text-4xl">Map</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Find classrooms and campus facilities. Your location is used only to help you navigate the campus.</p>
      </div>

      <div className="campus-map-layout grid min-w-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
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
          </div>

          {priorityDestination ? (
            <article className="campus-map-priority min-w-0 rounded-lg border border-result-slate bg-result-slate-soft p-4">
              <p className="font-mono text-xs font-bold uppercase tracking-wide text-accent-primary">{locationStatus || 'Next class'}</p>
              <h2 className="mt-2 font-display text-lg font-bold [overflow-wrap:anywhere]">{priorityEntry.subjectName}</h2>
              <p className="mt-1 text-sm text-text-secondary">{destinationContext(priorityDestination)}</p>
              <button type="button" onClick={() => selectDestination(priorityDestination)} className="mt-4 min-h-11 rounded-lg bg-result-slate px-4 py-2 font-bold text-text-on-dark hover:bg-result-slate-hover">Navigate</button>
            </article>
          ) : null}

          <div className="campus-map-location min-w-0 rounded-lg border border-border-default bg-surface-primary p-4">
            <div className="flex items-start gap-3">
              <HiOutlineShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-xl text-result-slate" />
              <div>
                <h2 className="font-bold">Use your location</h2>
                <p className="mt-1 text-sm leading-6 text-text-secondary">Allow location access to show where you are on campus. It is not stored or attached to your student record.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={geolocation.start}
              disabled={geolocation.status === 'loading' || geolocation.status === 'denied'}
              className="mt-4 min-h-11 rounded-lg border border-result-slate px-4 py-2 font-bold text-result-slate-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {geolocation.status === 'loading' ? 'Finding your location...' : 'Use my location'}
            </button>
            {geolocation.message ? <p className="mt-3 text-sm leading-6 text-text-secondary" role="status">{geolocation.message}</p> : null}
            <label htmlFor="manual-start" className="mt-5 block text-sm font-bold">Choose starting point</label>
            <select id="manual-start" value={manualStartId} onChange={(event) => setManualStartId(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-border-input bg-surface-primary px-3">
              <option value="">Select a verified location</option>
              {manualLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </div>
        </div>

        <div className="campus-map-main min-w-0 space-y-4">
          <div className="campus-map-canvas relative min-w-0">
            <Suspense fallback={<div className="flex min-h-[420px] items-center justify-center rounded-lg border border-border-default bg-surface-muted" role="status">Loading campus map...</div>}>
              <CampusMap destination={selectedDestination} focus={mapFocus} locations={CAMPUS_LOCATIONS} position={start} recenterToken={recenterToken} route={route} />
            </Suspense>
            <div className="absolute bottom-7 right-3 z-[600] flex flex-col items-end gap-2 sm:bottom-4 sm:right-4 sm:flex-row">
              <button
                type="button"
                onClick={() => { setMapFocus('campus'); setRecenterToken((value) => value + 1) }}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface-primary px-3 py-2 font-bold shadow-result"
              >
                <HiOutlineViewGrid aria-hidden="true" className="text-xl text-result-slate" /> Campus
              </button>
              <button
                type="button"
                onClick={() => { setMapFocus('selection'); setRecenterToken((value) => value + 1) }}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface-primary px-3 py-2 font-bold shadow-result"
              >
                <HiOutlineLocationMarker aria-hidden="true" className="text-xl text-result-slate" /> Recenter
              </button>
            </div>
          </div>

          <article className="campus-map-details min-w-0 rounded-lg border border-border-default bg-surface-primary p-5" aria-live="polite">
            {selectedDestination ? (
              <>
                <p className="font-mono text-xs font-bold uppercase tracking-wide text-accent-primary">Selected destination</p>
                <h2 className="mt-2 font-display text-2xl font-bold [overflow-wrap:anywhere]">{selectedDestination.name}</h2>
                <p className="mt-2 text-sm text-text-secondary">{destinationContext(selectedDestination) || `${selectedDestination.category} · Exact coordinates not surveyed`}</p>
                {selectedDestination.coordinatePrecision ? <p className="mt-2 text-xs text-text-secondary">Map position: {selectedDestination.coordinatePrecision}.</p> : null}

                {indoorSteps.length ? (
                  <div className="mt-5">
                    <h3 className="font-bold">Indoor guidance</h3>
                    <ol className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
                      {indoorSteps.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                    <p className="mt-3 text-xs leading-5 text-text-secondary">GPS cannot determine your floor, wing, or room indoors.</p>
                  </div>
                ) : null}

                <div className="mt-5">
                  {!start ? <p className="text-sm font-semibold text-text-secondary">Use your location or choose a starting point to see directions.</p> : null}
                  {route?.kind === 'network' ? (
                    <div>
                      <h3 className="font-bold">Walking route · {Math.round(route.distanceMeters)} m</h3>
                      <ol className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
                        {route.steps.map((step, index) => <li key={`${step}-${index}`}>{index + 1}. {step}</li>)}
                      </ol>
                    </div>
                  ) : null}
                  {route?.kind === 'straight' ? (
                    <div className="border-l-4 border-accent-highlight pl-3">
                      <p className="font-bold">Direct line · about {Math.round(route.distanceMeters)} m</p>
                      <p className="mt-1 text-sm leading-6 text-text-secondary">A surveyed walking path does not reach this location yet.</p>
                    </div>
                  ) : null}
                  {!selectedDestination.coordinates ? <p className="text-sm font-semibold text-text-secondary">Directions unavailable until this location is surveyed.</p> : null}
                </div>
              </>
            ) : (
              <div className="py-4 text-center">
                <HiOutlineLocationMarker aria-hidden="true" className="mx-auto text-3xl text-result-slate" />
                <h2 className="mt-3 font-display text-xl font-bold">Choose a destination</h2>
                <p className="mt-2 text-sm text-text-secondary">Search for a room or select a campus shortcut.</p>
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  )
}
