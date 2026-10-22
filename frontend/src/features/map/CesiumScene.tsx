import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { api } from '@/api/client'
import type { FloodState, GeoFeature, Layers } from '@/api/types'
import { useConsole, type HighlightKind } from '@/state/consoleStore'
import { rng } from './scene/geo'
import { clusterIcon, shelterIcon, stagingIcon } from './scene/icons'

// Public, token-free Esri services: satellite imagery plus global elevation. No Cesium ion
// account is needed for this view.
const ESRI_IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
const ESRI_TERRAIN_URL = 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer'
export const MAP_CREDIT = 'Terrain & imagery: Esri, Maxar, Earthstar Geographics · Roads, river, buildings: OpenStreetMap contributors'

Cesium.Ion.defaultAccessToken = ''

const C = Cesium.Color
const COLOR = {
  road: C.fromCssColorString('#f1e7d2'),
  cut: C.fromCssColorString('#ef4444'),
  bridge: C.fromCssColorString('#f59e0b'),
  river: C.fromCssColorString('#2563eb').withAlpha(0.8),
  building: C.fromCssColorString('#e9e4da'),
  highlight: C.fromCssColorString('#ef4444'),
}
const WALLS = ['#f3eee4', '#efe3cc', '#e3ecef', '#f4dccb', '#ece6bf', '#e2dcd2', '#f6f4ef', '#dde6d3', '#f1d6d6', '#d9e4f2'].map((c) => C.fromCssColorString(c))
const ROOFS = ['#8d949c', '#9a5a41', '#4f7398', '#6f8060', '#a9adb2', '#b0603e', '#3f6e7a'].map((c) => C.fromCssColorString(c))
const ROAD_WIDTH: Record<string, number> = { trunk: 9, primary: 8, secondary: 7, tertiary: 5, unclassified: 4, residential: 3 }
const STAMP = Cesium.JulianDate.fromIso8601('2026-10-21T05:30:00Z') // late morning in Assam: good light, no night shading

interface Picked {
  title: string
  rows: string[]
  highlight?: { kind: HighlightKind; id: string }
}

const pointOf = (f: GeoFeature) => f.geometry.coordinates as number[]
const lineOf = (f: GeoFeature) => f.geometry.coordinates as number[][]

interface Props {
  district: string
  layers: Layers
  flood: FloodState | undefined
  level: number
}

interface Scene {
  viewer: Cesium.Viewer
  roads: { primitive: Cesium.GroundPolylinePrimitive; edges: { id: string; edge: number; hand: number }[] }
  clusters: { entity: Cesium.Entity; id: string; hand: number; population: number }[]
  shelters: { entity: Cesium.Entity; id: string; hand: number; kind: string }[]
  bridgePos: Map<string, Cesium.Cartesian3>
  baseline: number
  rect: Cesium.Rectangle
  water: Cesium.Primitive | null
  waterKey: string
  ring: Cesium.Entity | null
  appliedRoads: string
}

export function CesiumScene({ district, layers, flood, level }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<Scene | null>(null)
  const [status, setStatus] = useState('Loading real terrain and satellite imagery')
  const [note, setNote] = useState('')
  const [ready, setReady] = useState(false)
  const [tip, setTip] = useState<(Picked & { x: number; y: number }) | null>(null)
  const buildings = useQuery({ queryKey: ['buildings', district], queryFn: () => api.buildings(district), retry: false })
  const highlight = useConsole((s) => s.highlight)
  const setHighlight = useConsole((s) => s.setHighlight)

  useEffect(() => {
    const el = host.current
    if (!el || !buildings.isFetched) return
    let cancelled = false
    const viewer = new Cesium.Viewer(el, {
      baseLayer: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      animation: false,
      timeline: false,
      infoBox: false,
      selectionIndicator: false,
      shadows: true,
      shouldAnimate: true,
    })
    viewer.clock.currentTime = STAMP.clone()
    viewer.clock.shouldAnimate = false
    viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2)
    const sc = viewer.scene
    sc.globe.depthTestAgainstTerrain = true
    sc.globe.enableLighting = true
    sc.globe.maximumScreenSpaceError = 1.4
    sc.globe.showGroundAtmosphere = true
    sc.postProcessStages.fxaa.enabled = true
    sc.highDynamicRange = true
    sc.fog.enabled = true
    sc.fog.density = 0.00018
    sc.screenSpaceCameraController.minimumZoomDistance = 4
    if (viewer.creditDisplay) (viewer.creditDisplay.container as HTMLElement).style.display = 'none'
    if (import.meta.env.DEV) (window as unknown as { __aegisCesium?: Cesium.Viewer }).__aegisCesium = viewer

    const [lonMin, latMin, lonMax, latMax] = layers.bounds
    const rect = Cesium.Rectangle.fromDegrees(lonMin, latMin, lonMax, latMax)
    const midLon = (lonMin + lonMax) / 2
    const midLat = (latMin + latMax) / 2
    const spanM = Math.max((lonMax - lonMin) * 111320 * Math.cos((midLat * Math.PI) / 180), (latMax - latMin) * 110540)
    const home = () =>
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(midLon, midLat - (latMax - latMin) * 0.55, spanM * 0.55),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-32), roll: 0 },
      })
    home()

    const kx = 111320 * Math.cos((midLat * Math.PI) / 180)
    const ky = 110540
    const bridgeName = new Map(layers.bridges.map((b) => [b.id, b.name]))

    async function build() {
      let terrain: Cesium.TerrainProvider = viewer.terrainProvider
      try {
        const [imagery, tp] = await Promise.all([
          Cesium.ArcGisMapServerImageryProvider.fromUrl(ESRI_IMAGERY_URL),
          Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(ESRI_TERRAIN_URL),
        ])
        if (cancelled) return
        viewer.imageryLayers.addImageryProvider(imagery)
        viewer.terrainProvider = tp
        terrain = tp
        setStatus('')
      } catch {
        if (!cancelled) setStatus('Real terrain/imagery unavailable (offline): showing a plain globe')
      }

      // river
      for (const f of layers.river.features) {
        const coords = lineOf(f)
        if (coords.length < 2) continue
        viewer.entities.add({ polyline: { positions: Cesium.Cartesian3.fromDegreesArray(coords.flat()), clampToGround: true, width: 8, material: COLOR.river } })
      }

      // roads and bridges: two batched ground primitives instead of thousands of entities
      const normal: Cesium.GeometryInstance[] = []
      const edges: { id: string; edge: number; hand: number }[] = []
      const bridgeInst: Cesium.GeometryInstance[] = []
      const bridgePos = new Map<string, Cesium.Cartesian3>()
      for (const f of layers.roads.features) {
        const coords = lineOf(f)
        if (coords.length < 2) continue
        const key = String(f.properties.key || '')
        const isBridge = Boolean(f.properties.bridge)
        const positions = Cesium.Cartesian3.fromDegreesArray(coords.flat())
        const edge = Number(f.properties.i)
        if (isBridge) {
          const id = key ? `bridge:${key}:${edge}` : `bridgeedge:${edge}`
          bridgeInst.push(new Cesium.GeometryInstance({ id, geometry: new Cesium.GroundPolylineGeometry({ positions, width: key ? 9 : 6 }), attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(COLOR.bridge) } }))
          if (key && !bridgePos.has(key)) bridgePos.set(key, positions[0])
        } else {
          const id = `road:${edge}`
          normal.push(new Cesium.GeometryInstance({ id, geometry: new Cesium.GroundPolylineGeometry({ positions, width: ROAD_WIDTH[String(f.properties.cls)] ?? 3 }), attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(COLOR.road) } }))
          edges.push({ id, edge, hand: Number(f.properties.hand) })
        }
      }
      const roadPrimitive = new Cesium.GroundPolylinePrimitive({ geometryInstances: normal, appearance: new Cesium.PolylineColorAppearance(), asynchronous: true })
      sc.groundPrimitives.add(roadPrimitive)
      if (bridgeInst.length) sc.groundPrimitives.add(new Cesium.GroundPolylinePrimitive({ geometryInstances: bridgeInst, appearance: new Cesium.PolylineColorAppearance(), asynchronous: true }))
      for (const [key, pos] of bridgePos) {
        const c = Cesium.Cartographic.fromCartesian(pos)
        viewer.entities.add({
          position: Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, 25),
          label: { text: bridgeName.get(key) ?? key, font: '600 13px sans-serif', fillColor: C.WHITE, outlineColor: C.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, showBackground: true, backgroundColor: C.fromCssColorString('#92400e').withAlpha(0.8), pixelOffset: new Cesium.Cartesian2(0, -16), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9000), disableDepthTestDistance: Number.POSITIVE_INFINITY },
        })
      }

      // settlements, shelters and boat bases: pin icons that scale with distance
      const far = new Cesium.NearFarScalar(400, 1, 30000, 0.45)
      const maxPop = Math.max(...layers.clusters.features.map((f) => Number(f.properties.population)), 1)
      const clusters: Scene['clusters'] = []
      for (const f of layers.clusters.features) {
        const [lon, lat] = pointOf(f)
        const pop = Number(f.properties.population)
        const entity = viewer.entities.add({
          id: `cluster:${f.properties.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          billboard: { image: clusterIcon(pop, false), scale: 0.55 + 0.5 * Math.sqrt(pop / maxPop), verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, scaleByDistance: far, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: String(f.properties.name), font: '12px sans-serif', fillColor: C.WHITE, style: Cesium.LabelStyle.FILL, showBackground: true, backgroundColor: C.BLACK.withAlpha(0.55), pixelOffset: new Cesium.Cartesian2(0, 8), verticalOrigin: Cesium.VerticalOrigin.TOP, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3500), disableDepthTestDistance: Number.POSITIVE_INFINITY },
        })
        clusters.push({ entity, id: String(f.properties.id), hand: Number(f.properties.hand), population: pop })
      }
      const shelters: Scene['shelters'] = []
      for (const f of layers.shelters.features) {
        const [lon, lat] = pointOf(f)
        const kind = String(f.properties.kind)
        const assumed = kind.startsWith('assumed')
        const entity = viewer.entities.add({
          id: `shelter:${f.properties.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          billboard: { image: shelterIcon(false, assumed), scale: assumed ? 0.7 : 0.9, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, scaleByDistance: far, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: String(f.properties.name), font: '600 12px sans-serif', fillColor: C.WHITE, style: Cesium.LabelStyle.FILL, showBackground: true, backgroundColor: C.fromCssColorString('#166534').withAlpha(0.8), pixelOffset: new Cesium.Cartesian2(0, 8), verticalOrigin: Cesium.VerticalOrigin.TOP, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, assumed ? 1800 : 6000), disableDepthTestDistance: Number.POSITIVE_INFINITY },
        })
        shelters.push({ entity, id: String(f.properties.id), hand: Number(f.properties.hand), kind })
      }
      for (const f of layers.staging.features) {
        const [lon, lat] = pointOf(f)
        viewer.entities.add({
          id: `staging:${f.properties.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          billboard: { image: stagingIcon(), scale: 0.95, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, scaleByDistance: far, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: String(f.properties.name), font: '600 12px sans-serif', fillColor: C.WHITE, style: Cesium.LabelStyle.FILL, showBackground: true, backgroundColor: C.fromCssColorString('#5b21b6').withAlpha(0.85), pixelOffset: new Cesium.Cartesian2(0, 8), verticalOrigin: Cesium.VerticalOrigin.TOP, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9000), disableDepthTestDistance: Number.POSITIVE_INFINITY },
        })
      }

      // buildings mapped in OpenStreetMap, extruded by their recorded level count
      for (const b of buildings.data ?? []) {
        if (b.ring.length < 4) continue
        viewer.entities.add({
          polygon: { hierarchy: Cesium.Cartesian3.fromDegreesArray(b.ring.flat()), height: 0, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, extrudedHeight: (b.levels ?? 2) * 3.2, extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND, material: COLOR.building, outline: true, outlineColor: C.BLACK.withAlpha(0.25) },
        })
      }

      // river level in real elevation: sample terrain at the lowest-lying settlement
      let baseline = 0
      const lowest = [...layers.clusters.features].sort((a, b) => Number(a.properties.hand) - Number(b.properties.hand))[0]
      if (lowest) {
        const [lon, lat] = pointOf(lowest)
        try {
          const [s] = await Cesium.sampleTerrainMostDetailed(terrain, [Cesium.Cartographic.fromDegrees(lon, lat)])
          baseline = s.height - Number(lowest.properties.hand)
        } catch {
          baseline = 0
        }
      }
      if (cancelled) return

      // illustrative houses along residential streets, standing on real terrain
      const streets = layers.roads.features.filter((f) => ['residential', 'unclassified', 'tertiary'].includes(String(f.properties.cls)) && !f.properties.bridge)
      const lenM = (f: GeoFeature) => {
        const [[a, b], [c, d]] = lineOf(f)
        return Math.hypot((a - c) * kx, (b - d) * ky)
      }
      const totalLen = streets.reduce((s, f) => s + lenM(f), 0)
      const target = Math.min(Math.round(layers.totals.population / 14), 3200)
      const spacing = Math.max(16, (2 * totalLen) / Math.max(target, 1))
      const rand = rng(11)
      const spots: { lon: number; lat: number; w: number; d: number; h: number; heading: number; wall: Cesium.Color; roof: Cesium.Color }[] = []
      for (const f of streets) {
        const [[lon0, lat0], [lon1, lat1]] = lineOf(f)
        const len = lenM(f)
        if (len < 8) continue
        const ux = ((lon1 - lon0) * kx) / len
        const uz = ((lat1 - lat0) * ky) / len
        const heading = Math.atan2(ux, uz)
        for (let s = spacing * rand(); s < len - 4; s += spacing * (0.75 + 0.5 * rand())) {
          for (const side of [1, -1]) {
            if (rand() < 0.15) continue
            const off = 9 + rand() * 6
            const x = ux * s + uz * off * side
            const y = uz * s - ux * off * side
            spots.push({ lon: lon0 + x / kx, lat: lat0 + y / ky, w: 7 + rand() * 6, d: 6 + rand() * 6, h: (rand() < 0.6 ? 3.3 : rand() < 0.75 ? 6.4 : 9.5), heading, wall: WALLS[Math.floor(rand() * WALLS.length)], roof: ROOFS[Math.floor(rand() * ROOFS.length)] })
          }
        }
      }
      let heights: number[] = spots.map(() => 0)
      try {
        const sampled = await Cesium.sampleTerrainMostDetailed(terrain, spots.map((s) => Cesium.Cartographic.fromDegrees(s.lon, s.lat)))
        heights = sampled.map((c) => c.height)
      } catch {
        /* offline: houses sit on the ellipsoid */
      }
      if (cancelled) return
      const wallInst: Cesium.GeometryInstance[] = []
      const roofInst: Cesium.GeometryInstance[] = []
      const box = Cesium.BoxGeometry.fromDimensions({ dimensions: new Cesium.Cartesian3(1, 1, 1), vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT })
      spots.forEach((s, i) => {
        const g = heights[i]
        if (g < baseline + 0.8) return // keep houses out of the river bed
        const place = (z: number, sx: number, sy: number, sz: number) => {
          const m = Cesium.Transforms.headingPitchRollToFixedFrame(Cesium.Cartesian3.fromDegrees(s.lon, s.lat, g + z), new Cesium.HeadingPitchRoll(s.heading, 0, 0))
          return Cesium.Matrix4.multiplyByScale(m, new Cesium.Cartesian3(sx, sy, sz), m)
        }
        wallInst.push(new Cesium.GeometryInstance({ geometry: box, modelMatrix: place(s.h / 2, s.w, s.d, s.h), attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(s.wall) } }))
        roofInst.push(new Cesium.GeometryInstance({ geometry: box, modelMatrix: place(s.h + 0.35, s.w + 0.8, s.d + 0.8, 0.7), attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(s.roof) } }))
      })
      const look = new Cesium.PerInstanceColorAppearance({ translucent: false, closed: true })
      for (const geometryInstances of [wallInst, roofInst]) {
        if (geometryInstances.length) sc.primitives.add(new Cesium.Primitive({ geometryInstances, appearance: look, shadows: Cesium.ShadowMode.ENABLED, asynchronous: true }))
      }
      setNote(`${wallInst.length.toLocaleString()} illustrative houses along streets, in proportion to population${(buildings.data?.length ?? 0) ? `, plus ${buildings.data!.length} buildings mapped in OpenStreetMap` : ''}`)

      scene.current = { viewer, roads: { primitive: roadPrimitive, edges }, clusters, shelters, bridgePos, baseline, rect, water: null, waterKey: '', ring: null, appliedRoads: '' }
      setReady(true)
    }
    void build()

    const handler = new Cesium.ScreenSpaceEventHandler(sc.canvas)
    const describe = (id: string): Picked | null => {
      if (id.startsWith('cluster:')) {
        const f = layers.clusters.features.find((x) => `cluster:${x.properties.id}` === id)
        return f ? { title: String(f.properties.name), rows: [`${Number(f.properties.population).toLocaleString()} people`, `floods when water is ${f.properties.hand} m above normal`], highlight: { kind: 'cluster', id: String(f.properties.id) } } : null
      }
      if (id.startsWith('shelter:')) {
        const f = layers.shelters.features.find((x) => `shelter:${x.properties.id}` === id)
        return f ? { title: String(f.properties.name), rows: [`capacity ${f.properties.capacity}`, String(f.properties.kind).replace(/_/g, ' '), String(f.properties.source)], highlight: { kind: 'shelter', id: String(f.properties.id) } } : null
      }
      if (id.startsWith('staging:')) {
        const f = layers.staging.features.find((x) => `staging:${x.properties.id}` === id)
        return f ? { title: String(f.properties.name), rows: ['boat base'], highlight: { kind: 'staging', id: String(f.properties.id) } } : null
      }
      if (id.startsWith('bridge:')) {
        const key = id.split(':')[1]
        const feature = layers.roads.features.find((x) => x.properties.key === key)
        return { title: bridgeName.get(key) ?? key, rows: [`deck goes under at ${feature?.properties.hand ?? '?'} m above normal`], highlight: { kind: 'bridge', id: key } }
      }
      return null
    }
    const idOf = (picked: unknown): string => {
      const p = picked as { id?: unknown } | undefined
      if (typeof p?.id === 'string') return p.id
      return p?.id instanceof Cesium.Entity ? String(p.id.id) : ''
    }
    handler.setInputAction((m: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      const info = describe(idOf(sc.pick(m.endPosition)))
      sc.canvas.style.cursor = info ? 'pointer' : 'default'
      setTip(info ? { ...info, x: m.endPosition.x + 14, y: m.endPosition.y + 14 } : null)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    handler.setInputAction((c: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const info = describe(idOf(sc.pick(c.position)))
      if (info?.highlight) setHighlight(info.highlight)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    return () => {
      cancelled = true
      handler.destroy()
      scene.current = null
      setReady(false)
      viewer.destroy()
    }
  }, [layers, buildings.isFetched, buildings.data, setHighlight])

  // water surface: animated water material at the real elevation of the current level
  useEffect(() => {
    const s = scene.current
    if (!s || !ready) return
    const key = `${level.toFixed(2)}|${s.baseline.toFixed(1)}`
    if (key === s.waterKey) return
    s.waterKey = key
    if (s.water) s.viewer.scene.primitives.remove(s.water)
    const pad = 0.2
    const w = s.rect.east - s.rect.west
    const h = s.rect.north - s.rect.south
    const rectangle = new Cesium.Rectangle(s.rect.west - w * pad, s.rect.south - h * pad, s.rect.east + w * pad, s.rect.north + h * pad)
    const material = new Cesium.Material({
      fabric: {
        type: 'Water',
        uniforms: { baseWaterColor: new Cesium.Color(0.09, 0.27, 0.36, 0.78), blendColor: new Cesium.Color(0.1, 0.3, 0.35, 0), normalMap: Cesium.buildModuleUrl('Assets/Textures/waterNormals.jpg'), frequency: 6000, animationSpeed: 0.018, amplitude: 2.2, specularIntensity: 0.7 },
      },
    })
    s.water = s.viewer.scene.primitives.add(
      new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({ geometry: new Cesium.RectangleGeometry({ rectangle, height: s.baseline + Math.max(level, 0.05), vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT }) }),
        appearance: new Cesium.EllipsoidSurfaceAppearance({ aboveGround: true, material }),
        asynchronous: false,
      }),
    )
  }, [level, ready])

  // flood state: cut roads, flooded settlements and shelters
  useEffect(() => {
    const s = scene.current
    if (!s || !ready) return
    const cut = flood ? new Set(flood.cut_edges) : null
    const floodedClusters = new Set(flood?.flooded_clusters ?? [])
    for (const c of s.clusters) {
      const isFlooded = flood ? floodedClusters.has(c.id) : c.hand < level
      c.entity.billboard!.image = new Cesium.ConstantProperty(clusterIcon(c.population, isFlooded))
    }
    const floodedShelters = new Set(flood?.flooded_shelters ?? [])
    for (const sh of s.shelters) {
      const isFlooded = flood ? floodedShelters.has(sh.id) : sh.hand < level
      sh.entity.billboard!.image = new Cesium.ConstantProperty(shelterIcon(isFlooded, sh.kind.startsWith('assumed')))
    }
    const paint = () => {
      const key = `${flood?.level_m ?? level}|${flood?.cut_edges.length ?? 0}`
      if (!s.roads.primitive.ready) return false
      if (key === s.appliedRoads) return true
      for (const r of s.roads.edges) {
        const attr = s.roads.primitive.getGeometryInstanceAttributes(r.id)
        if (!attr) continue
        const isCut = cut ? cut.has(r.edge) : r.hand < level
        attr.color = Cesium.ColorGeometryInstanceAttribute.toValue(isCut ? COLOR.cut : COLOR.road)
      }
      s.appliedRoads = key
      return true
    }
    if (paint()) return
    const off = s.viewer.scene.postRender.addEventListener(() => {
      if (paint()) off()
    })
    return () => off()
  }, [flood, level, ready])

  // highlight ring and fly-to
  useEffect(() => {
    const s = scene.current
    if (!s || !ready) return
    if (s.ring) {
      s.viewer.entities.remove(s.ring)
      s.ring = null
    }
    if (!highlight) return
    const entity = s.viewer.entities.getById(`${highlight.kind}:${highlight.id}`)
    const position = highlight.kind === 'bridge' ? s.bridgePos.get(highlight.id) : entity?.position?.getValue(Cesium.JulianDate.now())
    if (!position) return
    const carto = Cesium.Cartographic.fromCartesian(position)
    s.ring = s.viewer.entities.add({
      position,
      ellipse: { semiMajorAxis: 22, semiMinorAxis: 22, height: 0, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, material: COLOR.highlight.withAlpha(0.3), outline: true, outlineColor: COLOR.highlight, outlineWidth: 3 },
    })
    s.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude - 0.0045, 650),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-42), roll: 0 },
      duration: 1.4,
    })
  }, [highlight, ready, layers])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={host} className="absolute inset-0" role="img" aria-label="Real-terrain 3D view of the district with satellite imagery, roads, bridges, houses and flood water" />
      {tip && (
        <div className="pointer-events-none absolute z-20 max-w-64 rounded-lg border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur" style={{ left: tip.x, top: tip.y }}>
          <div className="font-semibold">{tip.title}</div>
          {tip.rows.map((r) => <div key={r} className="text-muted-foreground">{r}</div>)}
        </div>
      )}
      {status && <div className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-card/90 px-3 py-1.5 text-xs shadow">{status}</div>}
      <div className="pointer-events-none absolute bottom-2 right-3 z-10 max-w-[60%] text-right text-[10px] leading-tight text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0/0.8)]">
        {MAP_CREDIT}
        {note && <><br />{note}</>}
      </div>
    </div>
  )
}
