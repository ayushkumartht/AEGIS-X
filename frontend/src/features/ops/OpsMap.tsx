import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { GeoFeature, OpsEvents, WatchedDistrict } from '@/api/types'
import { LEVEL_COLOR, LEVEL_LABEL, SEVERITY_COLOR } from './levels'

// Vite pre-bundles maplibre-gl, which breaks its default worker location: point it at the worker file.
maplibregl.setWorkerUrl(workerUrl)

// Esri's light-gray canvas (token-free, labels in English) keeps the coloured markers readable. Set
// VITE_OSM_RASTER_TILE_URL to use a different raster basemap, for example OpenStreetMap's own tiles.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'
const TILE_URL = import.meta.env.VITE_OSM_RASTER_TILE_URL as string | undefined
const BASE_TILES = TILE_URL ?? `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`
const LABEL_TILES = TILE_URL ? null : `${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`
const ATTRIBUTION = TILE_URL ? '© OpenStreetMap contributors' : 'Map: Esri, HERE, Garmin, OpenStreetMap contributors'
const INDIA: maplibregl.LngLatBoundsLike = [[67.5, 6], [98.5, 37.5]]
type Collection = Parameters<maplibregl.GeoJSONSource['setData']>[0]
const COLLECTION = (features: unknown[]) => ({ type: 'FeatureCollection' as const, features }) as unknown as Collection
const pointOf = (geometry: unknown) => (geometry as { coordinates: [number, number] }).coordinates

interface Props {
  districts: WatchedDistrict[]
  events: OpsEvents | undefined
  selectedId: string | null
  focus: { lat: number; lon: number; label: string } | null
  onSelect: (districtId: string) => void
}

/** India map: watched districts coloured by flood level, official alerts coloured by severity. */
export function OpsMap({ districts, events, selectedId, focus, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const ready = useRef(false)
  const latest = useRef({ districts, events, selectedId, onSelect })
  latest.current = { districts, events, selectedId, onSelect }

  const paint = () => {
    const map = mapRef.current
    if (!map || !ready.current) return
    const { districts: ds, events: ev, selectedId: sel } = latest.current
    const dFeatures = ds.map((d) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
      properties: { id: d.id, name: d.name, state: d.state, river: d.river, level: d.level, built: Boolean(d.console), selected: d.id === sel, reason: d.indicator?.reason ?? '' },
    }))
    ;(map.getSource('districts') as maplibregl.GeoJSONSource).setData(COLLECTION(dFeatures))
    const aFeatures = (ev?.geojson.features ?? []).map((f: GeoFeature) => ({ ...f, properties: { ...f.properties, color: SEVERITY_COLOR[String(f.properties.severity)] ?? SEVERITY_COLOR.Unknown } }))
    ;(map.getSource('alerts') as maplibregl.GeoJSONSource).setData(COLLECTION(aFeatures))
  }

  useEffect(() => {
    const el = host.current
    if (!el) return
    const map = new maplibregl.Map({
      container: el,
      style: {
        version: 8,
        sources: {
          base: { type: 'raster', tiles: [BASE_TILES], tileSize: 256, maxzoom: 16, attribution: ATTRIBUTION },
          ...(LABEL_TILES ? { labels: { type: 'raster', tiles: [LABEL_TILES], tileSize: 256, maxzoom: 16 } } : {}),
        },
        layers: [
          { id: 'base', type: 'raster', source: 'base' },
          ...(LABEL_TILES ? [{ id: 'labels', type: 'raster' as const, source: 'labels' }] : []),
        ],
      },
      bounds: INDIA,
      fitBoundsOptions: { padding: 16 },
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

    map.on('load', () => {
      map.addSource('alerts', { type: 'geojson', data: COLLECTION([]) })
      map.addSource('districts', { type: 'geojson', data: COLLECTION([]) })
      map.addLayer({ id: 'alerts', type: 'circle', source: 'alerts', paint: { 'circle-radius': 6, 'circle-color': ['get', 'color'], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.9 } })
      map.addLayer({
        id: 'districts', type: 'circle', source: 'districts',
        paint: {
          'circle-radius': ['match', ['get', 'level'], 'severe', 13, 'warning', 12, 'watch', 10, 8],
          'circle-color': ['match', ['get', 'level'], 'severe', LEVEL_COLOR.severe, 'warning', LEVEL_COLOR.warning, 'watch', LEVEL_COLOR.watch, 'normal', LEVEL_COLOR.normal, LEVEL_COLOR.unknown],
          'circle-stroke-width': ['case', ['get', 'selected'], 4, ['get', 'built'], 3, 1.5],
          'circle-stroke-color': ['case', ['get', 'selected'], '#1d4ed8', ['get', 'built'], '#0f172a', '#ffffff'],
        },
      })
      ready.current = true
      paint()
    })

    map.on('click', 'districts', (e) => {
      const p = e.features?.[0]?.properties
      if (!p) return
      latest.current.onSelect(String(p.id))
      popup.setLngLat(pointOf(e.features![0].geometry))
        .setHTML(`<strong>${esc(p.name)}</strong><br>${esc(p.state)} · ${esc(p.river)}<br>Flood level: <strong>${esc(LEVEL_LABEL[p.level as keyof typeof LEVEL_LABEL])}</strong>${p.reason ? `<br><span style="opacity:.75">${esc(p.reason)}</span>` : ''}`)
        .addTo(map)
    })
    map.on('click', 'alerts', (e) => {
      const p = e.features?.[0]?.properties
      if (!p) return
      const g = p.gauge ? (typeof p.gauge === 'string' ? JSON.parse(p.gauge) : p.gauge) : null
      popup.setLngLat(pointOf(e.features![0].geometry))
        .setHTML(
          `<strong>${esc(p.event)}</strong> (${esc(p.severity)})<br>${esc(p.area)}<br><span style="opacity:.75">${esc(p.sender)}</span>` +
            (g ? `<br>Gauge ${esc(g.level_m)} m · warning ${esc(g.warning_m)} m · danger ${esc(g.danger_m)} m` : '') +
            `<br><span style="opacity:.6">position: ${esc(p.place_method)}</span>`,
        )
        .addTo(map)
    })
    for (const layer of ['districts', 'alerts']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
    }
    return () => {
      ready.current = false
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(paint, [districts, events, selectedId])

  // Frame the districts above normal when the set of them changes (first load, or switching data source);
  // when none is, show the whole country. A selection or a place search takes over from this.
  const hot = districts.filter((d) => d.level === 'severe' || d.level === 'warning' || d.level === 'watch')
  const hotKey = hot.map((d) => d.id).sort().join(',')
  const framed = useRef('')
  useEffect(() => {
    const map = mapRef.current
    if (!map || framed.current === hotKey) return
    const apply = () => {
      framed.current = hotKey
      if (hot.length >= 2) {
        const b = new maplibregl.LngLatBounds()
        hot.forEach((d) => b.extend([d.lon, d.lat]))
        map.fitBounds(b, { padding: 70, maxZoom: 6.5, duration: 800 })
      } else map.fitBounds(INDIA, { padding: 16, duration: 800 })
    }
    if (map.loaded()) apply()
    else map.once('load', apply)
    // `hot` is derived from `districts`; the key says when it actually changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotKey])

  useEffect(() => {
    const map = mapRef.current
    if (map && focus) map.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 8), duration: 900 })
  }, [focus])

  useEffect(() => {
    const d = districts.find((x) => x.id === selectedId)
    const map = mapRef.current
    if (map && d) map.flyTo({ center: [d.lon, d.lat], zoom: Math.max(map.getZoom(), 7), duration: 900 })
    // fly only when the selection changes, not when the data refreshes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border">
      {/* MapLibre's CSS makes its container position:relative, so the container needs a sized parent */}
      <div className="absolute inset-0">
        <div ref={host} className="h-full w-full" role="img" aria-label="Map of India with watched districts coloured by flood level and official alerts coloured by severity" />
      </div>
      <div className="absolute bottom-6 left-3 z-10 rounded-lg border bg-card/95 p-2 text-xs shadow backdrop-blur">
        <div className="mb-1 font-medium">District flood level</div>
        {(['severe', 'warning', 'watch', 'normal', 'unknown'] as const).map((l) => (
          <div key={l} className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full" style={{ background: LEVEL_COLOR[l] }} />{LEVEL_LABEL[l]}</div>
        ))}
        <div className="mt-1.5 font-medium">Official alert</div>
        <div className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full border border-white" style={{ background: SEVERITY_COLOR.Severe }} />coloured by severity</div>
        <div className="mt-1.5 flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full border-2 border-slate-900" />evacuation model built</div>
      </div>
    </div>
  )
}
