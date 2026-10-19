import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { FloodState, Layers } from '@/api/types'
import { useConsole } from '@/state/consoleStore'

interface Props {
  layers: Layers
  flood: FloodState | undefined
}

const COLORS = {
  road: '#94a3b8',
  cut: '#2563eb',
  river: '#38bdf8',
  bridge: '#f59e0b',
  cluster: '#f59e0b',
  clusterFlooded: '#dc2626',
  shelter: '#16a34a',
  shelterFlooded: '#6b7280',
  staging: '#7c3aed',
  highlight: '#ef4444',
}

// Vite pre-bundles maplibre-gl, which breaks its default worker location: point it at the worker file.
maplibregl.setWorkerUrl(workerUrl)

const isDark = () => document.documentElement.classList.contains('dark')
const NONE = ['==', ['get', 'id'], '__none__'] as maplibregl.FilterSpecification
const inList = (ids: (string | number)[], prop = 'id') =>
  (ids.length ? ['in', ['get', prop], ['literal', ids]] : ['==', ['get', prop], '__none__']) as maplibregl.FilterSpecification

const colorWhen = (ids: string[], hit: string, miss: string) =>
  ['case', ['in', ['get', 'id'], ['literal', ids]], hit, miss] as maplibregl.ExpressionSpecification

function popupText(title: string, rows: [string, string][]): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = 'font: 12px/1.4 system-ui, sans-serif; color: #0f172a; min-width: 150px'
  const h = document.createElement('div')
  h.style.fontWeight = '600'
  h.textContent = title
  el.appendChild(h)
  for (const [k, v] of rows) {
    const line = document.createElement('div')
    line.textContent = `${k}: ${v}`
    el.appendChild(line)
  }
  return el
}

export function MapView({ layers, flood }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const highlight = useConsole((s) => s.highlight)

  // create the map once per set of layers
  useEffect(() => {
    if (!box.current) return
    setReady(false)
    const map = new maplibregl.Map({
      container: box.current,
      style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': isDark() ? '#0f172a' : '#eef2f7' } }] },
      bounds: layers.bounds,
      fitBoundsOptions: { padding: 40 },
      attributionControl: false,
    })
    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __aegisMap?: maplibregl.Map }).__aegisMap = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      map.addSource('roads', { type: 'geojson', data: layers.roads as never })
      map.addSource('river', { type: 'geojson', data: layers.river as never })
      map.addSource('clusters', { type: 'geojson', data: layers.clusters as never })
      map.addSource('shelters', { type: 'geojson', data: layers.shelters as never })
      map.addSource('staging', { type: 'geojson', data: layers.staging as never })

      map.addLayer({ id: 'river', type: 'line', source: 'river', paint: { 'line-color': COLORS.river, 'line-width': 6, 'line-opacity': 0.7 } })
      map.addLayer({ id: 'roads', type: 'line', source: 'roads', paint: { 'line-color': COLORS.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 2] } })
      map.addLayer({ id: 'roads-cut', type: 'line', source: 'roads', filter: inList([], 'i'), paint: { 'line-color': COLORS.cut, 'line-width': 2.5, 'line-dasharray': [1.5, 1] } })
      map.addLayer({ id: 'bridges', type: 'line', source: 'roads', filter: ['!=', ['get', 'key'], ''] as never, paint: { 'line-color': COLORS.bridge, 'line-width': 5 } })
      map.addLayer({ id: 'highlight-line', type: 'line', source: 'roads', filter: NONE, paint: { 'line-color': COLORS.highlight, 'line-width': 10, 'line-opacity': 0.55 } })
      map.addLayer({ id: 'clusters', type: 'circle', source: 'clusters', paint: { 'circle-color': COLORS.cluster, 'circle-opacity': 0.8, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5, 'circle-radius': ['max', 5, ['*', 0.45, ['sqrt', ['get', 'population']]]] } })
      map.addLayer({ id: 'shelters', type: 'circle', source: 'shelters', paint: { 'circle-color': COLORS.shelter, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-radius': 7 } })
      map.addLayer({ id: 'staging', type: 'circle', source: 'staging', paint: { 'circle-color': COLORS.staging, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-radius': 6 } })
      for (const [kind, source] of [['cluster', 'clusters'], ['shelter', 'shelters'], ['staging', 'staging']] as const) {
        map.addLayer({ id: `hl-${kind}`, type: 'circle', source, filter: NONE, paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': COLORS.highlight, 'circle-stroke-width': 4, 'circle-radius': 18 } })
      }
      setReady(true)
    })

    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
    const show = (e: maplibregl.MapLayerMouseEvent, title: (p: Record<string, unknown>) => string, rows: (p: Record<string, unknown>) => [string, string][]) => {
      const f = e.features?.[0]
      if (!f) return
      const p = f.properties as Record<string, unknown>
      popup.setLngLat(e.lngLat).setDOMContent(popupText(title(p), rows(p))).addTo(map)
    }
    map.on('click', 'clusters', (e) => show(e, (p) => String(p.name), (p) => [['People', String(p.population)], ['Floods above', `${p.hand} m`]]))
    map.on('click', 'shelters', (e) => show(e, (p) => String(p.name), (p) => [['Capacity', String(p.capacity)], ['Kind', String(p.kind)], ['Floods above', `${p.hand} m`], ['Source', String(p.source)]]))
    map.on('click', 'staging', (e) => show(e, (p) => String(p.name), () => [['Boat base', 'yes']]))
    map.on('click', 'bridges', (e) => show(e, () => 'Bridge', (p) => [['Deck floods above', `${p.hand} m`], ['Class', String(p.cls)]]))
    for (const id of ['clusters', 'shelters', 'staging', 'bridges']) {
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''))
    }
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [layers])

  // flood overlay
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const apply = () => {
      const cut = flood?.cut_edges ?? []
      map.setFilter('roads-cut', inList(cut, 'i'))
      map.setPaintProperty('clusters', 'circle-color', colorWhen(flood?.flooded_clusters ?? [], COLORS.clusterFlooded, COLORS.cluster))
      map.setPaintProperty('shelters', 'circle-color', colorWhen(flood?.flooded_shelters ?? [], COLORS.shelterFlooded, COLORS.shelter))
    }
    apply()
  }, [flood, layers, ready])

  // highlight chosen from a list (Red Team, plan editor)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const apply = () => {
      const edges = highlight?.kind === 'bridge' ? (layers.bridges.find((b) => b.id === highlight.id)?.edges ?? []) : []
      map.setFilter('highlight-line', highlight?.kind === 'bridge' ? inList(edges, 'i') : NONE)
      for (const kind of ['cluster', 'shelter', 'staging'] as const) {
        map.setFilter(`hl-${kind}`, highlight?.kind === kind ? inList([highlight.id]) : NONE)
      }
    }
    apply()
  }, [highlight, layers, ready])

  return <div ref={box} className="h-full w-full" role="img" aria-label="Map of the district with roads, bridges, settlements, shelters and boat bases" />
}
