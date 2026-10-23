import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { ChevronDown, Layers, LocateFixed } from 'lucide-react'
import type { GeoFeature, OpsEvents, WatchedDistrict } from '@/api/types'
import { cn } from '@/lib/utils'
import { LEVEL_COLOR, LEVEL_LABEL, SEVERITY_COLOR } from './levels'

// Vite pre-bundles maplibre-gl, which breaks its default worker location: point it at the worker file.
maplibregl.setWorkerUrl(workerUrl)

// Esri's raster services are token-free and labelled in English. Set VITE_OSM_RASTER_TILE_URL to use
// a different raster basemap for the "Map" option, for example OpenStreetMap's own tiles.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
const TILE_URL = import.meta.env.VITE_OSM_RASTER_TILE_URL as string | undefined
const tile = (service: string) => `${ESRI}/${service}/MapServer/tile/{z}/{y}/{x}`

const BASEMAPS = [
  {
    id: 'streets',
    label: 'Map',
    tiles: TILE_URL ?? tile('World_Street_Map'),
    labels: null,
    dark: false,
    attribution: TILE_URL ? '© OpenStreetMap contributors' : 'Map: Esri, HERE, Garmin, OpenStreetMap contributors',
  },
  { id: 'satellite', label: 'Satellite', tiles: tile('World_Imagery'), labels: tile('Reference/World_Boundaries_and_Places'), dark: true, attribution: 'Imagery: Esri, Maxar, Earthstar Geographics' },
  { id: 'terrain', label: 'Terrain', tiles: tile('World_Topo_Map'), labels: null, dark: false, attribution: 'Map: Esri, HERE, Garmin, USGS, OpenStreetMap contributors' },
  { id: 'light', label: 'Light', tiles: tile('Canvas/World_Light_Gray_Base'), labels: tile('Canvas/World_Light_Gray_Reference'), dark: false, attribution: 'Map: Esri, HERE, Garmin, OpenStreetMap contributors' },
] as const
type BasemapId = (typeof BASEMAPS)[number]['id']
// a z5 tile over north-east India, used as the switcher's preview
const thumb = (tiles: string) => tiles.replace('{z}', '5').replace('{y}', '13').replace('{x}', '23')

const BASEMAP_KEY = 'aegis:ops-basemap'
const savedBasemap = (): BasemapId => {
  try {
    const v = localStorage.getItem(BASEMAP_KEY)
    return BASEMAPS.some((b) => b.id === v) ? (v as BasemapId) : 'streets'
  } catch {
    return 'streets'
  }
}

const INDIA: maplibregl.LngLatBoundsLike = [[67.5, 6], [98.5, 37.5]]
const HOT = ['severe', 'warning', 'watch']
type Collection = Parameters<maplibregl.GeoJSONSource['setData']>[0]
const COLLECTION = (features: unknown[]) => ({ type: 'FeatureCollection' as const, features }) as unknown as Collection
const pointOf = (geometry: unknown) => (geometry as { coordinates: [number, number] }).coordinates
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
const levelColor = ['match', ['get', 'level'], 'severe', LEVEL_COLOR.severe, 'warning', LEVEL_COLOR.warning, 'watch', LEVEL_COLOR.watch, 'normal', LEVEL_COLOR.normal, LEVEL_COLOR.unknown] as maplibregl.ExpressionSpecification
const hovered = ['boolean', ['feature-state', 'hover'], false] as maplibregl.ExpressionSpecification

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
  const [basemap, setBasemap] = useState<BasemapId>(savedBasemap)
  const [layersOpen, setLayersOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(true)
  const pulses = useRef(new Map<string, maplibregl.Marker>())

  const paint = () => {
    const map = mapRef.current
    if (!map || !ready.current) return
    const { districts: ds, events: ev, selectedId: sel } = latest.current

    // pulsing rings are CSS-animated HTML markers: the browser animates them without redrawing the map
    const hot = new Map(ds.filter((d) => d.level === 'severe' || d.level === 'warning').map((d) => [d.id, d]))
    for (const [id, marker] of pulses.current) {
      if (!hot.has(id)) {
        marker.remove()
        pulses.current.delete(id)
      }
    }
    for (const [id, d] of hot) {
      let marker = pulses.current.get(id)
      if (!marker) {
        const el = document.createElement('div')
        el.className = 'ops-pulse'
        marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([d.lon, d.lat]).addTo(map)
        pulses.current.set(id, marker)
      }
      marker.getElement().style.color = LEVEL_COLOR[d.level]
    }
    const dFeatures = ds.map((d) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
      properties: {
        id: d.id,
        name: d.name,
        state: d.state,
        river: d.river,
        level: d.level,
        console: d.console ?? '',
        built: Boolean(d.console),
        selected: d.id === sel,
        reason: d.indicator?.reason ?? '',
        alerts: d.alerts.length,
      },
    }))
    ;(map.getSource('districts') as maplibregl.GeoJSONSource).setData(COLLECTION(dFeatures))
    const aFeatures = (ev?.geojson.features ?? []).map((f: GeoFeature) => ({ ...f, properties: { ...f.properties, color: SEVERITY_COLOR[String(f.properties.severity)] ?? SEVERITY_COLOR.Unknown } }))
    ;(map.getSource('alerts') as maplibregl.GeoJSONSource).setData(COLLECTION(aFeatures))
  }

  const applyBasemap = (id: BasemapId) => {
    const map = mapRef.current
    if (!map || !ready.current) return
    for (const b of BASEMAPS) {
      const vis = b.id === id ? 'visible' : 'none'
      map.setLayoutProperty(`base-${b.id}`, 'visibility', vis)
      if (b.labels) map.setLayoutProperty(`labels-${b.id}`, 'visibility', vis)
    }
    const dark = BASEMAPS.find((b) => b.id === id)?.dark
    map.setPaintProperty('district-names', 'text-color', dark ? '#ffffff' : '#0f172a')
    map.setPaintProperty('district-names', 'text-halo-color', dark ? 'rgba(2,6,23,0.85)' : 'rgba(255,255,255,0.95)')
  }

  useEffect(() => {
    const el = host.current
    if (!el) return
    const initial = savedBasemap()
    const map = new maplibregl.Map({
      container: el,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: Object.fromEntries(
          BASEMAPS.flatMap((b) => [
            [`base-${b.id}`, { type: 'raster', tiles: [b.tiles], tileSize: 256, maxzoom: 18, attribution: b.attribution }],
            ...(b.labels ? [[`labels-${b.id}`, { type: 'raster', tiles: [b.labels], tileSize: 256, maxzoom: 18 }]] : []),
          ]),
        ) as maplibregl.StyleSpecification['sources'],
        layers: BASEMAPS.flatMap((b) => [
          { id: `base-${b.id}`, type: 'raster' as const, source: `base-${b.id}`, layout: { visibility: b.id === initial ? ('visible' as const) : ('none' as const) } },
          ...(b.labels
            ? [{ id: `labels-${b.id}`, type: 'raster' as const, source: `labels-${b.id}`, layout: { visibility: b.id === initial ? ('visible' as const) : ('none' as const) } }]
            : []),
        ]),
      },
      bounds: INDIA,
      fitBoundsOptions: { padding: 16 },
      attributionControl: { compact: true },
      maxPitch: 60,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.addControl(new maplibregl.FullscreenControl(), 'top-right')

    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 16, className: 'ops-popup' })
    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'ops-tip' })

    map.on('load', () => {
      map.addSource('alerts', { type: 'geojson', data: COLLECTION([]) })
      map.addSource('districts', { type: 'geojson', data: COLLECTION([]), promoteId: 'id' })

      map.addLayer({
        id: 'alerts',
        type: 'circle',
        source: 'alerts',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4.5, 8, 7],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      })
      map.addLayer({
        id: 'districts',
        type: 'circle',
        source: 'districts',
        paint: {
          'circle-radius': ['+', ['match', ['get', 'level'], 'severe', 12, 'warning', 11, 'watch', 9.5, 7.5], ['case', hovered, 4, 0]],
          'circle-color': levelColor,
          'circle-stroke-width': ['case', ['get', 'selected'], 4, ['get', 'built'], 3, 2],
          'circle-stroke-color': ['case', ['get', 'selected'], '#1d4ed8', ['get', 'built'], '#0f172a', '#ffffff'],
        },
      })
      map.addLayer({
        id: 'district-names',
        type: 'symbol',
        source: 'districts',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 8, 13],
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
          'symbol-sort-key': ['match', ['get', 'level'], 'severe', 0, 'warning', 1, 'watch', 2, 3],
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': 'rgba(255,255,255,0.95)',
          'text-halo-width': 1.6,
          // districts above normal are named at every zoom, the rest once zoomed in
          'text-opacity': ['step', ['zoom'], ['case', ['in', ['get', 'level'], ['literal', HOT]], 1, 0], 5.5, 1],
        },
      })
      ready.current = true
      applyBasemap(initial)
      paint()
    })

    // hover: enlarge the marker and show a small card
    let hoverId: string | number | undefined
    const clearHover = () => {
      if (hoverId !== undefined) map.setFeatureState({ source: 'districts', id: hoverId }, { hover: false })
      hoverId = undefined
      tip.remove()
      map.getCanvas().style.cursor = ''
    }
    map.on('mousemove', 'districts', (e) => {
      const f = e.features?.[0]
      if (!f || hoverId === f.id) return // same district: nothing to redraw
      if (hoverId !== undefined) map.setFeatureState({ source: 'districts', id: hoverId }, { hover: false })
      hoverId = f.id
      if (hoverId !== undefined) map.setFeatureState({ source: 'districts', id: hoverId }, { hover: true })
      const p = f.properties
      const color = LEVEL_COLOR[p.level as keyof typeof LEVEL_COLOR] ?? LEVEL_COLOR.unknown
      map.getCanvas().style.cursor = 'pointer'
      tip
        .setLngLat(pointOf(f.geometry))
        .setHTML(
          `<div class="ops-tip-row"><span class="ops-dot" style="background:${color}"></span><strong>${esc(p.name)}</strong></div>` +
            `<div class="ops-tip-sub">${esc(LEVEL_LABEL[p.level as keyof typeof LEVEL_LABEL])} · ${esc(p.river)}${Number(p.alerts) ? ` · ${esc(p.alerts)} alert${Number(p.alerts) > 1 ? 's' : ''}` : ''}</div>`,
        )
        .addTo(map)
    })
    map.on('mouseleave', 'districts', clearHover)
    map.on('mouseenter', 'alerts', () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', 'alerts', () => (map.getCanvas().style.cursor = ''))

    map.on('click', 'districts', (e) => {
      const f = e.features?.[0]
      const p = f?.properties
      if (!f || !p) return
      tip.remove()
      latest.current.onSelect(String(p.id))
      const color = LEVEL_COLOR[p.level as keyof typeof LEVEL_COLOR] ?? LEVEL_COLOR.unknown
      popup
        .setLngLat(pointOf(f.geometry))
        .setHTML(
          `<div class="ops-chip" style="background:${color}1f;color:${color}"><span class="ops-dot" style="background:${color}"></span>${esc(LEVEL_LABEL[p.level as keyof typeof LEVEL_LABEL])}</div>` +
            `<div class="ops-title">${esc(p.name)}</div>` +
            `<div class="ops-sub">${esc(p.state)} · ${esc(p.river)}</div>` +
            (p.reason ? `<p class="ops-body">${esc(p.reason)}</p>` : '') +
            (Number(p.alerts) ? `<p class="ops-body"><strong>${esc(p.alerts)}</strong> active official alert${Number(p.alerts) > 1 ? 's' : ''}</p>` : '') +
            (p.console ? `<a class="ops-link" href="/console/${encodeURIComponent(String(p.console))}">Open evacuation console →</a>` : ''),
        )
        .addTo(map)
    })
    map.on('click', 'alerts', (e) => {
      const f = e.features?.[0]
      const p = f?.properties
      if (!f || !p) return
      const g = p.gauge ? (typeof p.gauge === 'string' ? JSON.parse(p.gauge) : p.gauge) : null
      const color = SEVERITY_COLOR[String(p.severity)] ?? SEVERITY_COLOR.Unknown
      popup
        .setLngLat(pointOf(f.geometry))
        .setHTML(
          `<div class="ops-chip" style="background:${color}1f;color:${color}"><span class="ops-dot" style="background:${color}"></span>${esc(p.severity)}</div>` +
            `<div class="ops-title">${esc(p.event)}</div>` +
            `<div class="ops-sub">${esc(p.area)}</div>` +
            (g ? `<p class="ops-body">Gauge <strong>${esc(g.level_m)} m</strong> · warning ${esc(g.warning_m)} m · danger ${esc(g.danger_m)} m</p>` : '') +
            `<p class="ops-meta">${esc(p.sender)} · position: ${esc(p.place_method)}</p>`,
        )
        .addTo(map)
    })

    const markers = pulses.current
    return () => {
      markers.forEach((m) => m.remove())
      markers.clear()
      ready.current = false
      map.remove()
      mapRef.current = null
    }
    // the map is built once; later changes go through paint() and applyBasemap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(paint, [districts, events, selectedId])

  useEffect(() => {
    applyBasemap(basemap)
    try {
      localStorage.setItem(BASEMAP_KEY, basemap)
    } catch {
      /* storage blocked: the choice just isn't remembered */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap])

  // Frame the districts above normal when the set of them changes (first load, or switching data source);
  // when none is, show the whole country. A selection or a place search takes over from this.
  const hot = districts.filter((d) => HOT.includes(d.level))
  const hotKey = hot.map((d) => d.id).sort().join(',')
  const framed = useRef('')
  const frame = (duration = 800) => {
    const map = mapRef.current
    if (!map) return
    if (hot.length >= 2) {
      const b = new maplibregl.LngLatBounds()
      hot.forEach((d) => b.extend([d.lon, d.lat]))
      map.fitBounds(b, { padding: 70, maxZoom: 6.5, duration, pitch: 0, bearing: 0 })
    } else map.fitBounds(INDIA, { padding: 16, duration, pitch: 0, bearing: 0 })
  }
  useEffect(() => {
    const map = mapRef.current
    if (!map || framed.current === hotKey) return
    const apply = () => {
      framed.current = hotKey
      frame()
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

  const current = BASEMAPS.find((b) => b.id === basemap) ?? BASEMAPS[0]

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border">
      {/* MapLibre's CSS makes its container position:relative, so the container needs a sized parent */}
      <div className="absolute inset-0">
        <div ref={host} className="h-full w-full" role="img" aria-label="Map of India with watched districts coloured by flood level and official alerts coloured by severity" />
      </div>

      {/* top-left: reset view */}
      <button
        type="button"
        onClick={() => frame()}
        className="absolute top-3 left-3 z-10 inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-xs font-medium shadow-md transition hover:bg-muted"
        title="Back to the districts at risk"
      >
        <LocateFixed className="size-3.5" /> Reset view
      </button>

      {/* bottom-right: basemap switcher, Google Maps style */}
      <div className="absolute right-3 bottom-9 z-10 flex items-end gap-2">
        {layersOpen && (
          <div className="flex gap-1.5 rounded-xl border bg-card p-1.5 shadow-lg">
            {BASEMAPS.filter((b) => b.id !== basemap).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setBasemap(b.id)
                  setLayersOpen(false)
                }}
                className="group flex w-16 flex-col items-center gap-1 rounded-lg p-1 text-[11px] font-medium hover:bg-muted"
              >
                <img src={thumb(b.tiles)} alt="" className="size-12 rounded-md border object-cover transition group-hover:ring-2 group-hover:ring-primary" />
                {b.label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setLayersOpen((o) => !o)}
          aria-expanded={layersOpen}
          aria-label="Change map type"
          className="relative size-[70px] overflow-hidden rounded-xl border-2 border-white shadow-lg ring-1 ring-black/10 transition hover:scale-[1.03]"
        >
          <img src={thumb(current.tiles)} alt="" className="absolute inset-0 size-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/75 to-transparent pt-3 pb-1 text-[11px] font-semibold text-white">
            <Layers className="size-3" /> Layers
          </span>
        </button>
      </div>

      {/* bottom-left: legend */}
      <div className="absolute bottom-6 left-3 z-10 rounded-xl border bg-card p-2.5 text-xs shadow-md">
        <button type="button" onClick={() => setLegendOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 font-medium" aria-expanded={legendOpen}>
          District flood level
          <ChevronDown className={cn('size-3.5 transition-transform', !legendOpen && '-rotate-90')} />
        </button>
        {legendOpen && (
          <div className="mt-1.5 space-y-1">
            {(['severe', 'warning', 'watch', 'normal', 'unknown'] as const).map((l) => (
              <div key={l} className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full ring-2 ring-white" style={{ background: LEVEL_COLOR[l] }} />
                {LEVEL_LABEL[l]}
              </div>
            ))}
            <div className="mt-2 border-t pt-2 font-medium">Official alert</div>
            <div className="flex items-center gap-2">
              <span className="inline-block size-2 rounded-full border border-white" style={{ background: SEVERITY_COLOR.Severe }} />
              coloured by severity
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-full border-2 border-slate-900" />
              evacuation model built
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
