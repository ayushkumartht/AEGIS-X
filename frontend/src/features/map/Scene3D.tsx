import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { api } from '@/api/client'
import type { FloodState, Layers, TerrainGrid, Trace } from '@/api/types'
import { Button } from '@/components/ui/button'
import { useConsole } from '@/state/consoleStore'
import { InfoCard, type CardData, type CardKind } from './InfoCard'
import { boatGeometry, bridgeGroup, paddedBounds, personGeometry, roadMesh, TERRAIN_PAD, terrainMesh, treesMesh, waterNormals } from './scene/builders'
import { GeoFrame, lonLat } from './scene/geo'
import { housesMesh } from './scene/houses'
import { createBases, createCamps, createPins } from './scene/landmarks'
import { createLife } from './scene/life'
import { IMAGERY_CREDIT, loadSatellite } from './scene/satellite'

interface Props {
  layers: Layers
  terrain: TerrainGrid
  flood: FloodState | undefined
  level: number
}

const VEX = 1 // true scale: ground, water, houses and bridges share the same vertical scale
const HOURS_PER_SECOND = 1.6
const MAX_BOATS = 48
const MAX_PEOPLE = 500
const CUT = new THREE.Color('#ef4444')
const AMBER = new THREE.Color('#f59e0b')
const RED = new THREE.Color('#dc2626')
const GREEN = new THREE.Color('#22c55e')

function label(text: string, cls: string) {
  const el = document.createElement('div')
  el.className = `aegis-label ${cls}`
  el.textContent = text
  return new CSS2DObject(el)
}

const abbreviate = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))

function interp(series: number[], t: number) {
  const i = Math.min(Math.max(Math.floor(t), 0), series.length - 1)
  const j = Math.min(i + 1, series.length - 1)
  return series[i] + (series[j] - series[i]) * (t - i)
}

export function Scene3D({ layers, terrain, flood, level }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const { district, plan, whatIf, highlight, setHighlight } = useConsole()
  const buildings = useQuery({ queryKey: ['buildings', district], queryFn: () => api.buildings(district), retry: false })
  const [hover, setHover] = useState<{ card: CardData; x: number; y: number } | null>(null)
  const [overlay, setOverlay] = useState(true)
  const [status, setStatus] = useState('Building the scene')
  const [houseNote, setHouseNote] = useState('')
  const [lifeNote, setLifeNote] = useState('')
  const [trace, setTrace] = useState<Trace | null>(null)
  const [playing, setPlaying] = useState(false)
  const [hour, setHour] = useState(0)

  // everything the render loop reads lives in refs so React re-renders do not rebuild the scene
  const live = useRef({ level, trace: null as Trace | null, playing: false, t: 0, overlay: true, flood: undefined as FloodState | undefined, lvlNow: level })
  live.current.level = level
  live.current.trace = trace
  live.current.playing = playing
  live.current.overlay = overlay
  live.current.flood = flood
  const setHourRef = useRef(setHour)
  setHourRef.current = setHour
  const sceneApi = useRef<{ focus: (h: { kind: CardKind; id: string } | null) => void } | null>(null)

  const play = useMutation({
    mutationFn: (pick: 'median' | 'bad_day') => api.trace({ district, plan: plan ?? undefined, what_if: whatIf, pick, n_samples: 150, seed: 42 }),
    onSuccess: (t) => {
      live.current.t = 0
      setHour(0)
      setTrace(t)
      setPlaying(true)
    },
  })

  /** Details of a map object, computed from the district data, the plan and the last simulation. */
  const cardFor = (kind: CardKind, id: string, levelM: number): CardData | null => {
    const st = useConsole.getState()
    const p = st.plan
    const sim = st.sim
    if (kind === 'cluster') {
      const f = layers.clusters.features.find((x) => String(x.properties.id) === id)
      if (!f) return null
      const hand = Number(f.properties.hand)
      const pop = Number(f.properties.population)
      const margin = hand - levelM
      const rank = p?.priority?.indexOf(id) ?? -1
      const res = sim?.clusters.find((c) => c.id === id)
      const card: CardData = {
        kind,
        id,
        title: String(f.properties.name),
        subtitle: `${pop.toLocaleString()} people`,
        status: margin <= 0 ? { label: 'Under water now', tone: 'risk' } : { label: `Dry, ${margin.toFixed(1)} m of margin`, tone: margin < 1 ? 'warn' : 'safe' },
        stats: [
          { label: 'People', value: pop.toLocaleString() },
          { label: 'Floods when water reaches', value: `${hand.toFixed(1)} m` },
          { label: 'Evacuation priority', value: rank >= 0 ? `#${rank + 1} of ${p?.priority?.length ?? 0}` : 'not listed' },
        ],
        bars: res ? [
          { label: 'Evacuated in time (last run)', value: res.evacuated_share, max: 1, note: `${Math.round(res.evacuated_share * 100)}%`, tone: res.evacuated_share < 0.5 ? 'risk' : res.evacuated_share < 0.75 ? 'warn' : 'safe' },
          { label: 'Chance this area floods', value: res.flooded_probability, max: 1, note: `${Math.round(res.flooded_probability * 100)}%`, tone: res.flooded_probability > 0.6 ? 'risk' : 'muted' },
        ] : undefined,
        notes: res ? undefined : ['Test a plan to see how well this area is evacuated.'],
      }
      return card
    }
    if (kind === 'shelter') {
      const f = layers.shelters.features.find((x) => String(x.properties.id) === id)
      if (!f) return null
      const cap = Number(f.properties.capacity)
      const maxCap = Math.max(...layers.shelters.features.map((x) => Number(x.properties.capacity)), 1)
      const hand = Number(f.properties.hand)
      const assumed = String(f.properties.kind).startsWith('assumed')
      const used = p?.open_shelters?.includes(id)
      return {
        kind,
        id,
        title: String(f.properties.name),
        subtitle: String(f.properties.kind).replace(/_/g, ' '),
        status: hand < levelM ? { label: 'Shelter is flooded', tone: 'risk' } : assumed ? { label: 'Assumed assembly point', tone: 'warn' } : { label: 'Dry and usable', tone: 'safe' },
        stats: [
          { label: 'Capacity', value: cap.toLocaleString() },
          { label: 'Floods when water reaches', value: `${hand.toFixed(1)} m` },
          { label: 'In your plan', value: used ? 'Yes' : 'No' },
          { label: 'Source', value: String(f.properties.source).slice(0, 40) },
        ],
        bars: [{ label: 'Capacity vs the largest shelter', value: cap, max: maxCap, note: cap.toLocaleString() }],
        notes: [assumed ? 'No official shelter is mapped here: this is a high-ground point assumed for planning.' : 'Capacity is an estimate unless an official figure is cited.'],
      }
    }
    if (kind === 'staging') {
      const f = layers.staging.features.find((x) => String(x.properties.id) === id)
      if (!f) return null
      return {
        kind,
        id,
        title: String(f.properties.name),
        subtitle: 'Rescue boats are kept here',
        stats: [
          { label: 'Boats in your plan', value: String(p?.boats_at?.[id] ?? 0) },
          { label: 'Vehicles in your plan', value: String(p?.vehicles_at?.[id] ?? 0) },
        ],
        notes: ['Boats start from here once the order has reached people and the boats have arrived.'],
      }
    }
    const b = layers.bridges.find((x) => x.id === id)
    if (!b) return null
    const deck = Number(layers.roads.features.find((x) => x.properties.key === id)?.properties.hand)
    const closed = whatIf.bridge_closed?.includes(id)
    return {
      kind,
      id,
      title: b.name,
      subtitle: 'Key bridge',
      status: deck < levelM ? { label: 'Deck under water', tone: 'risk' } : closed ? { label: 'Closed in this what-if', tone: 'warn' } : { label: `Open, ${(deck - levelM).toFixed(1)} m above the water`, tone: 'safe' },
      stats: [
        { label: 'Deck goes under at', value: `${deck.toFixed(1)} m` },
        { label: 'Routed around by plan', value: p?.route_avoid?.includes(id) ? 'Yes' : 'No' },
      ],
      notes: ['Red Team knocks this bridge out to see how much worse the plan gets.'],
    }
  }
  const cardRef = useRef(cardFor)
  cardRef.current = cardFor

  useEffect(() => {
    const host = box.current
    if (!host || !buildings.isFetched) return
    let disposed = false
    const fr = new GeoFrame(terrain, VEX)
    const size = fr.size

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.78
    host.appendChild(renderer.domElement)
    const labels = new CSS2DRenderer()
    labels.setSize(host.clientWidth, host.clientHeight)
    labels.domElement.style.cssText = 'position:absolute;inset:0;pointer-events:none'
    host.appendChild(labels.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2('#cdd9e3', 0.28 / size)
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 1, size * 25)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI * 0.48
    controls.minDistance = 12
    controls.maxDistance = size * 1.8

    // sky, sun and image-based lighting
    const sky = new Sky()
    sky.scale.setScalar(size * 12)
    const su = sky.material.uniforms
    su.turbidity.value = 5
    su.rayleigh.value = 1.5
    su.mieCoefficient.value = 0.004
    su.mieDirectionalG.value = 0.82
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 40), THREE.MathUtils.degToRad(215))
    su.sunPosition.value.copy(sunDir)
    scene.add(sky)
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envScene = new THREE.Scene()
    envScene.add(sky.clone())
    const env = pmrem.fromScene(envScene).texture
    scene.environment = env

    const sun = new THREE.DirectionalLight('#fff4e0', 2.8)
    sun.castShadow = true
    sun.shadow.mapSize.set(4096, 4096)
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.5
    scene.add(sun, sun.target, new THREE.HemisphereLight('#dbe8f5', '#4a4632', 0.4))
    // the shadow map follows the camera focus, so houses near the camera get sharp shadows
    const fitSun = () => {
      const reach = Math.min(size * 0.6, Math.max(160, controls.getDistance() * 1.5))
      sun.target.position.copy(controls.target)
      sun.position.copy(controls.target).addScaledVector(sunDir, size)
      Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: size * 3 })
      sun.shadow.camera.updateProjectionMatrix()
    }

    // ground: natural colours now, satellite imagery as soon as it arrives
    let ground = terrainMesh(fr, null)
    scene.add(ground)
    const synthetic = Boolean(layers.metadata.synthetic)
    setStatus(synthetic ? '' : 'Loading satellite imagery')
    ;(synthetic ? Promise.resolve(null) : loadSatellite(paddedBounds(terrain.bounds), 140)).then((sat) => {
      if (disposed) return
      if (sat) {
        scene.remove(ground)
        ground.geometry.dispose()
        ;(ground.material as THREE.Material).dispose()
        ground = terrainMesh(fr, sat)
        scene.add(ground)
        setStatus('')
      } else if (!synthetic) setStatus('Satellite imagery unavailable (offline): showing terrain texture')
    })

    // river bed, roads, bridges, houses, trees
    for (const f of layers.river.features) {
      const pts = (f.geometry.coordinates as number[][]).map(([lon, lat]) => fr.point(lon, lat, 0.3))
      if (pts.length < 2) continue
      const ribbon = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.min(pts.length * 4, 900), size / 180, 8, false),
        new THREE.MeshStandardMaterial({ color: '#56634a', roughness: 0.3, metalness: 0.1 }),
      )
      ribbon.scale.y = 0.15
      scene.add(ribbon)
    }
    const roads = roadMesh(fr, layers.roads.features)
    scene.add(roads.mesh)
    const bridges = bridgeGroup(fr, layers)
    scene.add(bridges.group)
    const houses = housesMesh(fr, layers, buildings.data ?? [])
    scene.add(houses.group)
    setHouseNote(`${houses.count.toLocaleString()} illustrative houses (generated along streets, not surveyed)${houses.mapped ? `, plus ${houses.mapped} buildings mapped in OpenStreetMap` : ''}`)
    scene.add(treesMesh(fr, layers, Math.min(Math.round(size * 0.6), 6000)))

    // flood water: reflective surface at the current level
    const water = new Water(new THREE.PlaneGeometry(size * (1 + 2 * TERRAIN_PAD), size * (1 + 2 * TERRAIN_PAD)), {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals: waterNormals(),
      sunDirection: sunDir.clone(),
      sunColor: 0xfff4e0,
      waterColor: 0x4a4a32,
      distortionScale: 2.4,
      fog: true,
    })
    water.rotation.x = -Math.PI / 2
    water.material.uniforms.size.value = 0.06
    water.position.y = fr.y(0.05)
    scene.add(water)

    // settlements, shelters, boat bases
    const clusterFeatures = layers.clusters.features
    const clusterHand = clusterFeatures.map((f) => Number(f.properties.hand))
    const clusterPop = clusterFeatures.map((f) => Number(f.properties.population))
    const clusterPos = clusterFeatures.map((f) => {
      const [lon, lat] = lonLat(f)
      return fr.point(lon, lat)
    })
    const maxPop = Math.max(...clusterPop, 1)
    const shelterFeatures = layers.shelters.features
    const shelterCap = shelterFeatures.map((f) => Number(f.properties.capacity))
    const camps = createCamps(fr, shelterFeatures, size)
    scene.add(camps.group)
    const bases = createBases(fr, layers.staging.features, size)
    scene.add(bases.group)
    const shelterPos = shelterFeatures.map((f) => {
      const [lon, lat] = lonLat(f)
      return fr.point(lon, lat)
    })

    // analysis overlay: ground discs, floating pins, population badges, labels
    const overlayGroup = new THREE.Group()
    scene.add(overlayGroup)
    const discGeo = new THREE.CylinderGeometry(1, 1, 1, 48).translate(0, 0.5, 0)
    const discs = new THREE.InstancedMesh(discGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.32, depthWrite: false }), clusterFeatures.length)
    discs.renderOrder = 3
    overlayGroup.add(discs)
    const pins = createPins(clusterPos, clusterPop, size)
    overlayGroup.add(pins.mesh)
    const pinPeople = clusterPop.slice()
    const pinColor = clusterFeatures.map(() => AMBER.clone())
    const setDisc = (k: number, people: number, color: THREE.Color) => {
      const r = (size / 160) * Math.sqrt(Math.max(people, 0) / maxPop) + size / 1000
      discs.setMatrixAt(k, new THREE.Matrix4().compose(clusterPos[k], new THREE.Quaternion(), new THREE.Vector3(r, 0.6, r)))
      discs.setColorAt(k, color)
    }
    clusterFeatures.forEach((_, k) => setDisc(k, clusterPop[k], AMBER))
    const badges = clusterPop
      .map((p, k) => ({ p, k }))
      .sort((a, b) => b.p - a.p)
      .slice(0, 26)
      .map(({ p, k }) => {
        const tag = label(abbreviate(p), 'aegis-label-pop')
        tag.position.set(clusterPos[k].x, clusterPos[k].y + pins.height(p) + 16, clusterPos[k].z)
        overlayGroup.add(tag)
        return { tag, k }
      })
    shelterFeatures.forEach((f, k) => {
      if (String(f.properties.kind).startsWith('assumed')) return
      const tag = label(String(f.properties.name), 'aegis-label-shelter')
      tag.position.copy(camps.topOf(k)).add(new THREE.Vector3(0, 8, 0))
      overlayGroup.add(tag)
    })
    for (const f of layers.staging.features) {
      const p = bases.positions.get(String(f.properties.id))
      if (!p) continue
      const tag = label(String(f.properties.name), 'aegis-label-staging')
      tag.position.set(p.x, p.y + 22, p.z)
      overlayGroup.add(tag)
    }
    for (const b of layers.bridges) {
      const segs = bridges.byKey.get(b.id)
      if (!segs?.length) continue
      const c = new THREE.Box3()
      segs.forEach((s) => c.expandByObject(s))
      const tag = label(b.name, 'aegis-label-bridge')
      tag.position.copy(c.getCenter(new THREE.Vector3()).add(new THREE.Vector3(0, 12, 0)))
      overlayGroup.add(tag)
    }

    // life: traffic, lamps, river boats, birds, clouds, helicopter, cattle, crowds, debris
    const life = createLife(fr, layers, size, shelterPos, shelterCap)
    scene.add(life.group)
    setLifeNote(Object.entries(life.counts).filter(([, n]) => n > 0).map(([k, n]) => `${n.toLocaleString()} ${k}`).join(' · '))

    // boats and people moving during playback
    const boatScale = Math.max(1, size / 3000)
    const boats = new THREE.InstancedMesh(boatGeometry(), new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.45 }), MAX_BOATS)
    boats.castShadow = true
    const personScale = Math.max(1.2, size / 2200)
    const people = new THREE.InstancedMesh(personGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.8 }), MAX_PEOPLE)
    const clothes = ['#b91c1c', '#1d4ed8', '#f59e0b', '#047857', '#7c3aed', '#f1f5f9', '#db2777', '#0f766e']
    for (let i = 0; i < MAX_PEOPLE; i++) people.setColorAt(i, new THREE.Color(clothes[i % clothes.length]))
    people.castShadow = true
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let i = 0; i < MAX_BOATS; i++) boats.setMatrixAt(i, hidden)
    for (let i = 0; i < MAX_PEOPLE; i++) people.setMatrixAt(i, hidden)
    scene.add(boats, people)
    const nearestShelter = clusterPos.map((p) => {
      let best = 0
      shelterPos.forEach((s, k) => {
        if (p.distanceToSquared(s) < p.distanceToSquared(shelterPos[best])) best = k
      })
      return shelterPos[best] ?? p
    })

    // focus ring for the highlighted element
    const ring = new THREE.Mesh(new THREE.TorusGeometry(size / 110, Math.max(size / 1500, 0.8), 12, 64), new THREE.MeshBasicMaterial({ color: '#ef4444' }))
    ring.rotation.x = -Math.PI / 2
    ring.visible = false
    scene.add(ring)
    let focusTarget: THREE.Vector3 | null = null
    sceneApi.current = {
      focus: (h) => {
        ring.visible = false
        focusTarget = null
        if (!h) return
        let at: THREE.Vector3 | null = null
        if (h.kind === 'bridge') {
          const segs = bridges.byKey.get(h.id)
          if (segs?.length) {
            const bx = new THREE.Box3()
            segs.forEach((s) => bx.expandByObject(s))
            at = bx.getCenter(new THREE.Vector3())
          }
        } else if (h.kind === 'cluster') at = clusterPos[clusterFeatures.findIndex((f) => String(f.properties.id) === h.id)] ?? null
        else if (h.kind === 'shelter') at = shelterPos[shelterFeatures.findIndex((f) => String(f.properties.id) === h.id)] ?? null
        else at = bases.positions.get(h.id) ?? null
        if (at) {
          ring.position.copy(at).add(new THREE.Vector3(0, 2, 0))
          ring.visible = true
          focusTarget = at.clone()
        }
      },
    }

    // start close to the biggest settlement so the houses are visible straight away
    const top = clusterPop.indexOf(maxPop)
    const focus = clusterPos[top] ?? new THREE.Vector3()
    controls.target.copy(focus)
    camera.position.set(focus.x - size * 0.03, focus.y + size * 0.028, focus.z + size * 0.06)
    controls.update()

    // picking
    const ray = new THREE.Raycaster()
    const ptr = new THREE.Vector2()
    const pickables = () => [...(live.current.overlay ? [discs, pins.mesh] : []), ...camps.pickables, bases.group, bridges.group]
    const pick = (ev: PointerEvent): { kind: CardKind; id: string } | null => {
      const r = renderer.domElement.getBoundingClientRect()
      ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ptr, camera)
      for (const hit of ray.intersectObjects(pickables(), true)) {
        const o = hit.object
        if ((o === discs || o === pins.mesh) && hit.instanceId !== undefined) return { kind: 'cluster', id: String(clusterFeatures[hit.instanceId].properties.id) }
        if (hit.instanceId !== undefined) {
          const k = camps.shelterOf(o, hit.instanceId)
          if (k !== null) return { kind: 'shelter', id: String(shelterFeatures[k].properties.id) }
        }
        const ud = o.userData
        if (ud.kind === 'bridge') return { kind: 'bridge', id: String(ud.id) }
        if (ud.kind === 'staging') return { kind: 'staging', id: String(ud.id) }
      }
      return null
    }
    let down = { x: 0, y: 0 }
    const onMove = (ev: PointerEvent) => {
      if (ev.buttons) return
      const hit = pick(ev)
      const r = host.getBoundingClientRect()
      renderer.domElement.style.cursor = hit ? 'pointer' : ''
      const card = hit ? cardRef.current(hit.kind, hit.id, live.current.lvlNow) : null
      setHover(card ? { card, x: ev.clientX - r.left, y: ev.clientY - r.top } : null)
    }
    const onDown = (ev: PointerEvent) => (down = { x: ev.clientX, y: ev.clientY })
    const onUp = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) return
      const hit = pick(ev)
      if (hit) setHighlight(hit)
    }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    const resize = new ResizeObserver(() => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      labels.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    resize.observe(host)

    // state shown on the map: recomputed only when the water level or the hour changes
    const roadHand = new Map(layers.roads.features.map((f) => [Number(f.properties.i), Number(f.properties.hand)]))
    let shownKey = ''
    const applyState = (lvl: number, hourIdx: number) => {
      const L = live.current
      const key = `${lvl.toFixed(2)}|${hourIdx}|${L.overlay}|${L.trace ? L.trace.pick : '-'}|${L.flood?.level_m ?? ''}`
      if (key === shownKey) return
      shownKey = key
      const cutSet = L.trace ? null : new Set(L.flood?.cut_edges ?? [])
      roads.edgeOf.forEach((edge, k) => {
        const isCut = L.overlay && (cutSet ? cutSet.has(edge) : (roadHand.get(edge) ?? Infinity) < lvl)
        const c = isCut ? CUT : roads.baseColor[k]
        for (let v = 0; v < 6; v++) roads.colorAttr.setXYZ(k * 6 + v, c.r, c.g, c.b)
      })
      roads.colorAttr.needsUpdate = true
      clusterFeatures.forEach((_, k) => {
        const flooded = clusterHand[k] < lvl
        const left = L.trace ? L.trace.remaining[Math.min(hourIdx, L.trace.remaining.length - 1)][k] : clusterPop[k]
        const color = flooded ? (left > 1 ? RED : GREEN) : AMBER
        pinPeople[k] = left
        pinColor[k] = color
        setDisc(k, left, color)
      })
      badges.forEach(({ tag, k }) => {
        const flooded = clusterHand[k] < lvl
        const left = pinPeople[k]
        tag.element.className = `aegis-label aegis-label-pop${flooded ? (left > 1 ? ' flooded' : ' safe') : ''}`
        tag.element.textContent = abbreviate(left)
      })
      camps.setFlooded(shelterFeatures.map((f) => Number(f.properties.hand) < lvl))
      discs.instanceMatrix.needsUpdate = true
      if (discs.instanceColor) discs.instanceColor.needsUpdate = true
    }

    let frameId = 0
    const timer = new THREE.Timer()
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const yAxis = new THREE.Vector3(0, 1, 0)
    const tick = () => {
      frameId = requestAnimationFrame(tick)
      timer.update()
      const dt = Math.min(timer.getDelta(), 0.1)
      const t = timer.getElapsed()
      const L = live.current
      water.material.uniforms.time.value += dt * 0.6
      let lvl = L.level
      let hourIdx = 0
      if (L.trace) {
        const last = L.trace.level.length - 1
        if (L.playing) {
          L.t = Math.min(L.t + dt * HOURS_PER_SECOND, last)
          if (L.t >= last) setHourRef.current(last)
        }
        lvl = interp(L.trace.level, L.t)
        hourIdx = Math.floor(L.t)
        if (Math.floor(L.t) !== Math.floor(L.t - dt * HOURS_PER_SECOND)) setHourRef.current(hourIdx)
      }
      L.lvlNow = lvl
      const targetY = fr.y(Math.max(lvl, 0.05))
      water.position.y += (targetY - water.position.y) * 0.15
      applyState(lvl, hourIdx)
      overlayGroup.visible = L.overlay
      pinColor.forEach((c, k) => pins.place(k, pinPeople[k], c, t))
      pins.mesh.instanceMatrix.needsUpdate = true
      if (pins.mesh.instanceColor) pins.mesh.instanceColor.needsUpdate = true
      camps.update(t)
      life.update({ t, dt, waterY: water.position.y, levelM: lvl })

      // boats shuttle between their base and the flooded areas they serve this hour
      let used = 0
      let walkers = 0
      if (L.trace && L.t >= L.trace.boats_on_h) {
        const row = L.trace.by_boat[Math.min(hourIdx, L.trace.by_boat.length - 1)] ?? []
        const targets = row.map((v, k) => [v, k]).filter(([v]) => v > 0.5).sort((a, b) => b[0] - a[0]).map(([, k]) => k)
        const fleet = Math.min(MAX_BOATS, Math.round(L.trace.boats_total * (L.trace.conditions.boat_availability_pct ?? 1)))
        const baseList = [...bases.positions.entries()].filter(([id]) => (L.trace?.staging[id] ?? 0) > 0).map(([, p]) => p)
        if (targets.length && baseList.length) {
          for (let i = 0; i < fleet; i++) {
            const k = targets[i % targets.length]
            const to = clusterPos[k]
            const from = baseList.reduce((a, b) => (a.distanceToSquared(to) < b.distanceToSquared(to) ? a : b))
            const phase = (L.t * 1.3 + i * 0.37) % 1
            const s = phase < 0.5 ? phase * 2 : (1 - phase) * 2
            const p = new THREE.Vector3().lerpVectors(from, to, s)
            p.y = water.position.y - 0.4
            q.setFromAxisAngle(yAxis, -Math.atan2(to.z - from.z, to.x - from.x) + (phase < 0.5 ? 0 : Math.PI))
            m.compose(p, q, new THREE.Vector3(boatScale, boatScale, boatScale))
            boats.setMatrixAt(used++, m)
          }
        }
        const landRow = L.trace.by_land[Math.min(hourIdx, L.trace.by_land.length - 1)] ?? []
        const sources = landRow.map((v, k) => [v, k]).filter(([v]) => v > 0.5)
        const total = sources.reduce((s, [v]) => s + v, 0)
        if (total > 0) {
          const n = Math.min(MAX_PEOPLE, Math.max(20, Math.round(total / 15)))
          let k = 0
          let acc = 0
          for (let j = 0; j < n; j++) {
            const share = (j + 0.5) / n
            while (k < sources.length - 1 && (acc + sources[k][0]) / total < share) acc += sources[k++][0]
            const c = sources[k][1]
            const prog = (L.t * 0.9 + j * 0.137) % 1
            const p = new THREE.Vector3().lerpVectors(clusterPos[c], nearestShelter[c], prog)
            p.y = fr.y(fr.groundAtXZ(p.x, p.z)) + 0.2
            m.compose(p, q.identity(), new THREE.Vector3(personScale, personScale, personScale))
            people.setMatrixAt(walkers++, m)
          }
        }
      }
      for (let i = used; i < MAX_BOATS; i++) boats.setMatrixAt(i, hidden)
      for (let i = walkers; i < MAX_PEOPLE; i++) people.setMatrixAt(i, hidden)
      boats.instanceMatrix.needsUpdate = true
      people.instanceMatrix.needsUpdate = true

      if (ring.visible) {
        ring.rotation.z += dt
        const s = 1 + 0.12 * Math.sin(t * 4)
        ring.scale.set(s, s, s)
        if (focusTarget) controls.target.lerp(focusTarget, 0.05)
      }
      controls.update()
      fitSun()
      renderer.render(scene, camera)
      labels.render(scene, camera)
    }
    tick()
    setStatus((s) => (s === 'Building the scene' ? '' : s))
    if (import.meta.env.DEV) (window as unknown as { __aegis3d?: unknown }).__aegis3d = { scene, camera, renderer, controls }

    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      resize.disconnect()
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        mesh.geometry?.dispose()
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      })
      env.dispose()
      pmrem.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
      host.removeChild(labels.domElement)
      sceneApi.current = null
    }
  }, [layers, terrain, buildings.isFetched, buildings.data, setHighlight])

  useEffect(() => {
    sceneApi.current?.focus(highlight)
  }, [highlight, layers, terrain, buildings.isFetched])

  const stop = () => {
    setPlaying(false)
    setTrace(null)
  }
  const scrub = (h: number) => {
    live.current.t = h
    setHour(h)
  }
  const h = Math.min(hour, (trace?.level.length ?? 1) - 1)
  const lvlNow = trace ? trace.level[h] : level
  const hands = layers.clusters.features.map((f) => Number(f.properties.hand))
  const floodedAreas = hands.filter((x) => x < lvlNow).length
  const inDanger = trace ? trace.remaining[h].reduce((s, v, k) => s + (hands[k] < lvlNow ? v : 0), 0) : 0
  const pinned = highlight ? cardFor(highlight.kind, highlight.id, lvlNow) : null

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={box} className="absolute inset-0" role="img" aria-label="Realistic 3D view of the district with satellite imagery, terrain, houses, traffic, bridges, relief camps and flood water" />

      <div className="absolute left-1/2 top-3 z-10 flex w-[min(44rem,calc(100%-9rem))] -translate-x-1/2 flex-col gap-2 rounded-xl border bg-card/90 p-2.5 text-xs shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {!trace ? (
            <>
              <Button size="sm" onClick={() => play.mutate('median')} disabled={play.isPending || !plan}>Play a typical future</Button>
              <Button size="sm" variant="outline" onClick={() => play.mutate('bad_day')} disabled={play.isPending || !plan}>Play a bad day</Button>
              <span className="text-muted-foreground">{play.isPending ? 'Simulating 150 futures to pick one' : 'Watch the current plan unfold hour by hour.'}</span>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => (h >= trace.level.length - 1 ? (scrub(0), setPlaying(true)) : setPlaying((p) => !p))}>
                {playing ? 'Pause' : h >= trace.level.length - 1 ? 'Replay' : 'Play'}
              </Button>
              <Button size="sm" variant="ghost" onClick={stop}>Back to manual level</Button>
              <span className="font-medium">{trace.pick === 'bad_day' ? 'Bad day (10th percentile)' : 'Typical future (median)'}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">evacuated in time: {Math.round((trace.metrics.evacuated_pct ?? 0) * 100)}%</span>
            </>
          )}
        </div>
        {trace && (
          <>
            <input type="range" className="w-full accent-primary" aria-label="Hour of the simulated future" min={0} max={trace.level.length - 1} step={1} value={h} onChange={(e) => { setPlaying(false); scrub(Number(e.target.value)) }} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
              <span className="font-semibold">Hour {h}</span>
              <span>Water {lvlNow.toFixed(1)} m above normal</span>
              <span>{floodedAreas} of {hands.length} areas flooded</span>
              <span>{Math.round(inDanger).toLocaleString()} people still in flooded areas</span>
              <span className="text-muted-foreground">{h < trace.start_h ? `order reaches people at hour ${trace.start_h.toFixed(0)}` : h < trace.boats_on_h ? `boats arrive at hour ${trace.boats_on_h.toFixed(0)}` : 'boats operating'}</span>
            </div>
          </>
        )}
        {play.isError && <p className="text-risk">{String(play.error)}</p>}
      </div>

      <label className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border bg-card/90 px-2.5 py-1.5 text-xs shadow backdrop-blur">
        <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
        Analysis overlay
      </label>

      {pinned && (
        <div className="absolute right-3 top-14 z-20">
          <InfoCard data={pinned} onClose={() => setHighlight(null)} />
        </div>
      )}
      {hover && !(highlight && hover.card.id === highlight.id && hover.card.kind === highlight.kind) && (
        <div className="pointer-events-none absolute z-20" style={{ left: Math.min(hover.x + 16, (box.current?.clientWidth ?? 600) - 250), top: Math.min(hover.y + 16, (box.current?.clientHeight ?? 400) - 190) }}>
          <InfoCard data={hover.card} compact />
        </div>
      )}
      {status && <div className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-card/90 px-3 py-1.5 text-xs shadow">{status}</div>}
      <div className="pointer-events-none absolute bottom-2 right-3 z-10 max-w-[60%] text-right text-[10px] leading-tight text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0/0.8)]">
        {IMAGERY_CREDIT} · Roads, river © OpenStreetMap contributors
        <br />
        {houseNote}
        <br />
        {lifeNote}
      </div>
    </div>
  )
}
