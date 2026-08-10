import { useEffect, useMemo, useState } from 'react'
import { divIcon } from 'leaflet'
import { CircleMarker, LayersControl, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  CAMPUS_BOUNDS,
  CAMPUS_CENTER,
  UNIVERSITY_BUILDING_COORDINATES,
} from '../../services/campusLocations'
import { bearingDegrees } from '../../services/campusPathGraph'

function MapController({ destination, focus, position, recenterToken, route }) {
  const map = useMap()

  useEffect(() => {
    if (route?.pathCoordinates?.length > 1 && focus !== 'campus') {
      map.fitBounds(route.pathCoordinates, { padding: [42, 42], maxZoom: 19 })
    } else if (focus === 'campus') {
      map.fitBounds(CAMPUS_BOUNDS, { padding: [18, 18] })
    } else if (position?.coordinates && destination?.coordinates) {
      map.fitBounds([position.coordinates, destination.coordinates], { padding: [42, 42], maxZoom: 18 })
    } else if (position?.coordinates) {
      map.setView(position.coordinates, 18)
    } else if (destination?.coordinates) {
      map.setView(destination.coordinates, 18)
    } else {
      map.fitBounds(CAMPUS_BOUNDS, { padding: [18, 18] })
    }
  }, [destination, focus, map, position, recenterToken, route])

  return null
}

export default function CampusMap({ destination, focus, locations = [], position, recenterToken, route, routeMode = 'preview' }) {
  const [ready, setReady] = useState(false)
  const directArrow = useMemo(() => {
    if (route?.kind !== 'straight' || route.pathCoordinates.length !== 2) return null
    const [start, end] = route.pathCoordinates
    return {
      coordinates: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
      icon: divIcon({
        className: 'campus-route-arrow',
        html: `<span style="--route-bearing:${bearingDegrees(start, end)}deg"></span>`,
        iconAnchor: [16, 16],
        iconSize: [32, 32],
      }),
    }
  }, [route])

  return (
    <div className="campus-map relative min-h-[420px] overflow-hidden rounded-lg border border-border-default bg-surface-muted" aria-label="Interactive BBD University campus map" data-route-mode={route ? routeMode : 'none'}>
      {!ready ? <div className="absolute inset-0 z-[500] flex items-center justify-center bg-surface-muted font-semibold" role="status">Loading campus map...</div> : null}
      <MapContainer
        center={CAMPUS_CENTER}
        zoom={16}
        minZoom={14}
        maxZoom={20}
        scrollWheelZoom
        className="h-full min-h-[420px] w-full"
        whenReady={() => setReady(true)}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
              url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Street">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxNativeZoom={19}
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <MapController destination={destination} focus={focus} position={position} recenterToken={recenterToken} route={route} />
        {route?.pathCoordinates?.length > 1 ? (
          <>
            <Polyline
              positions={route.pathCoordinates}
              pathOptions={{ color: '#fffdf7', weight: routeMode === 'active' ? 11 : 9, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={route.pathCoordinates}
              pathOptions={routeMode === 'active'
                ? { color: '#456a89', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' }
                : { color: '#d7e2ea', weight: 5, opacity: 1, dashArray: '9 11', lineCap: 'round' }}
            />
          </>
        ) : null}
        {directArrow ? <Marker position={directArrow.coordinates} icon={directArrow.icon} interactive={false} /> : null}
        <CircleMarker center={UNIVERSITY_BUILDING_COORDINATES} radius={8} pathOptions={{ color: '#ffffff', fillColor: '#456a89', fillOpacity: 0.95, weight: 3 }}>
          <Popup>BBD University Building</Popup>
        </CircleMarker>
        {locations.filter((location) => location.category !== 'Classroom' && location.coordinates && location.id !== destination?.id).map((location) => (
          <CircleMarker key={location.id} center={location.coordinates} radius={6} pathOptions={{ color: '#ffffff', fillColor: '#456a89', fillOpacity: 0.9, weight: 2 }}>
            <Popup>{location.name}</Popup>
          </CircleMarker>
        ))}
        {position?.coordinates ? (
          <CircleMarker center={position.coordinates} radius={9} pathOptions={{ color: '#ffffff', fillColor: '#456a89', fillOpacity: 1, weight: 4 }}>
            <Popup>{position.name || 'Your current location'}{position.accuracy ? ` (within about ${Math.round(position.accuracy)} m)` : ''}</Popup>
          </CircleMarker>
        ) : null}
        {destination?.coordinates ? (
          <CircleMarker center={destination.coordinates} radius={10} pathOptions={{ color: '#ffffff', fillColor: '#843f43', fillOpacity: 1, weight: 4 }}>
            <Popup>{destination.category === 'Classroom' ? destination.building : destination.name}</Popup>
          </CircleMarker>
        ) : null}
      </MapContainer>
    </div>
  )
}
