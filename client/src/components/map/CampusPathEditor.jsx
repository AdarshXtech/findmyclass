import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { CAMPUS_BOUNDS, CAMPUS_CENTER, CAMPUS_LOCATIONS } from '../../services/campusLocations'
import { CAMPUS_PATH_EDGES, CAMPUS_PATH_NODES } from '../../services/campusPaths'
import { distanceMeters, serializeCampusPaths } from '../../services/campusPathGraph'

const PATH_DRAFT_KEY = 'findmyclass-campus-path-draft'
const NODE_SNAP_DISTANCE_METERS = 3
const LOCATION_PINS = CAMPUS_LOCATIONS.filter((location, index, locations) => (
  location.coordinates
  && locations.findIndex((candidate) => candidate.coordinates?.join() === location.coordinates.join()) === index
))

function readDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(PATH_DRAFT_KEY))
    return Array.isArray(draft?.nodes) && Array.isArray(draft?.edges) ? draft : null
  } catch {
    return null
  }
}

function MapClickHandler({ onAdd }) {
  useMapEvents({
    click(event) {
      onAdd([event.latlng.lat, event.latlng.lng])
    },
  })
  return null
}

function nextNodeId(nodes) {
  let number = nodes.length + 1
  while (nodes.some((node) => node.id === `n${String(number).padStart(4, '0')}`)) number += 1
  return `n${String(number).padStart(4, '0')}`
}

function edgeExists(edges, from, to) {
  return edges.some(([a, b]) => (a === from && b === to) || (a === to && b === from))
}

export default function CampusPathEditor() {
  const [nodes, setNodes] = useState(() => (readDraft()?.nodes || CAMPUS_PATH_NODES).map((node) => ({ ...node })))
  const [edges, setEdges] = useState(() => (readDraft()?.edges || CAMPUS_PATH_EDGES).map((edge) => [...edge]))
  const [activeNodeId, setActiveNodeId] = useState(null)
  const [history, setHistory] = useState([])
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const edgeLines = edges.map(([from, to]) => [nodeById.get(from)?.coordinates, nodeById.get(to)?.coordinates]).filter((line) => line.every(Boolean))

  useEffect(() => {
    try {
      localStorage.setItem(PATH_DRAFT_KEY, JSON.stringify({ nodes, edges }))
    } catch {
      // Export remains available when browser storage is disabled.
    }
  }, [edges, nodes])

  const remember = () => setHistory((current) => [...current, { nodes, edges }])

  const addNode = (coordinates) => {
    const nearbyNode = nodes.find((node) => distanceMeters(coordinates, node.coordinates) <= NODE_SNAP_DISTANCE_METERS)
    if (nearbyNode) {
      if (activeNodeId && activeNodeId !== nearbyNode.id && !edgeExists(edges, activeNodeId, nearbyNode.id)) {
        remember()
        setEdges((current) => [...current, [activeNodeId, nearbyNode.id]])
      }
      setActiveNodeId(nearbyNode.id)
      return
    }

    remember()
    const id = nextNodeId(nodes)
    setNodes((current) => [...current, { id, coordinates }])
    if (activeNodeId) setEdges((current) => [...current, [activeNodeId, id]])
    setActiveNodeId(id)
  }

  const selectNode = (id) => {
    if (activeNodeId && activeNodeId !== id && !edgeExists(edges, activeNodeId, id)) {
      remember()
      setEdges((current) => [...current, [activeNodeId, id]])
    }
    setActiveNodeId(id)
  }

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setNodes(previous.nodes)
    setEdges(previous.edges)
    setHistory((current) => current.slice(0, -1))
    setActiveNodeId(null)
  }

  const reset = () => {
    setNodes(CAMPUS_PATH_NODES.map((node) => ({ ...node })))
    setEdges(CAMPUS_PATH_EDGES.map((edge) => [...edge]))
    setHistory([])
    setActiveNodeId(null)
  }

  const download = () => {
    const blob = new Blob([serializeCampusPaths(nodes, edges)], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'campusPaths.js'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-h-11 border border-border-default bg-surface-primary px-3 py-2 font-mono text-sm font-bold">{nodes.length} nodes</span>
        <span className="min-h-11 border border-border-default bg-surface-primary px-3 py-2 font-mono text-sm font-bold">{edges.length} segments</span>
        <button type="button" onClick={download} className="min-h-11 border border-border-strong bg-accent-highlight px-4 py-2 font-bold text-text-primary">Save path file</button>
        <button type="button" onClick={() => setActiveNodeId(null)} disabled={!activeNodeId} className="min-h-11 border border-border-strong bg-surface-primary px-4 py-2 font-bold disabled:opacity-50">Stop chain</button>
        <button type="button" onClick={undo} disabled={!history.length} className="min-h-11 border border-border-strong bg-surface-primary px-4 py-2 font-bold disabled:opacity-50">Undo</button>
        <button type="button" onClick={reset} className="min-h-11 border border-border-strong bg-surface-primary px-4 py-2 font-bold">Reset</button>
      </div>

      <p className="text-sm font-semibold text-text-secondary" role="status">
        {activeNodeId ? `Tracing from ${activeNodeId}` : 'Ready for a new path'} · Draft saved in this browser
      </p>

      <p className="text-sm text-text-secondary"><span className="font-bold text-accent-primary">Yellow pins</span> show the destinations defined on the student map.</p>

      <div className="campus-map min-h-[520px] overflow-hidden border border-border-default bg-surface-muted">
        <MapContainer center={CAMPUS_CENTER} zoom={17} minZoom={14} maxZoom={20} maxBounds={CAMPUS_BOUNDS} className="h-full min-h-[520px] w-full">
          <TileLayer
            attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
            url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={19}
            maxZoom={20}
          />
          <MapClickHandler onAdd={addNode} />
          {LOCATION_PINS.map((location) => (
            <CircleMarker
              key={`location-${location.id}`}
              center={location.coordinates}
              radius={7}
              bubblingMouseEvents={false}
              pathOptions={{ color: '#272621', fillColor: '#e5b932', fillOpacity: 1, weight: 2 }}
            >
              <Popup>{location.name}</Popup>
            </CircleMarker>
          ))}
          {edgeLines.flatMap((coordinates, index) => [
            <Polyline key={`${index}-outline`} positions={coordinates} pathOptions={{ color: '#fffdf7', weight: 10, opacity: 0.96, lineCap: 'round' }} />,
            <Polyline key={`${index}-path`} positions={coordinates} pathOptions={{ color: '#843f43', weight: 5, opacity: 1, lineCap: 'round' }} />,
          ])}
          {nodes.map((node) => (
            <CircleMarker
              key={node.id}
              center={node.coordinates}
              radius={activeNodeId === node.id ? 8 : 6}
              bubblingMouseEvents={false}
              eventHandlers={{ click: () => selectNode(node.id) }}
              pathOptions={{ color: '#ffffff', fillColor: activeNodeId === node.id ? '#843f43' : '#456a89', fillOpacity: 1, weight: 2 }}
            >
              <Popup>{node.id}</Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
