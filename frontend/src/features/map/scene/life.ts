import * as THREE from 'three'
import type { Layers } from '@/api/types'
import { boatGeometry, personGeometry } from './builders'
import { GeoFrame, lineLonLat, rng } from './geo'
import { autoGeometry, birdGeometry, busGeometry, carGeometry, cloudTexture, cowGeometry, helicopterGroup, lampGeometries, powerPoleGeometry } from './models'

/** Everything that moves or stands around in the scene besides the analysis overlay. */
export interface Ctx {
  t: number // seconds
  dt: number
  waterY: number // current world height of the flood surface
  levelM: number // metres above the river's normal level
}
export interface Life {
  group: THREE.Group
  update: (c: Ctx) => void
  counts: Record<string, number>
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0)
const UP = new THREE.Vector3(0, 1, 0)
const ARTERIAL = new Set(['trunk', 'primary', 'secondary', 'tertiary'])
const SIM_SPEED = 4 // traffic runs faster than real life so it is visible from the air

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, n)
  m.castShadow = shadow
  m.receiveShadow = true
  m.frustumCulled = false
  return m
}

/* ------------------------------------------------------------------ traffic */

interface Vehicle {
  e: number
  dir: 1 | -1
  s: number
  speed: number
  kind: 0 | 1 | 2 // car, auto, bus
  slot: number
}

function createTraffic(fr: GeoFrame, layers: Layers, count: number) {
  const key = (lon: number, lat: number) => `${lon.toFixed(6)},${lat.toFixed(6)}`
  const ids = new Map<string, number>()
  const xz: [number, number][] = []
  const adj: number[][] = []
  const node = (lon: number, lat: number) => {
    const k = key(lon, lat)
    let i = ids.get(k)
    if (i === undefined) {
      i = xz.length
      ids.set(k, i)
      xz.push([fr.x(lon), fr.z(lat)])
      adj.push([])
    }
    return i
  }
  type E = { a: number; b: number; len: number; hand: number; arterial: boolean }
  const edges: E[] = []
  for (const f of layers.roads.features) {
    const [[lon0, lat0], [lon1, lat1]] = lineLonLat(f)
    const a = node(lon0, lat0)
    const b = node(lon1, lat1)
    const len = Math.hypot(xz[a][0] - xz[b][0], xz[a][1] - xz[b][1])
    if (len < 2 || a === b) continue
    adj[a].push(edges.length)
    adj[b].push(edges.length)
    edges.push({ a, b, len, hand: Number(f.properties.hand), arterial: ARTERIAL.has(String(f.properties.cls)) })
  }
  const group = new THREE.Group()
  if (!edges.length) return { group, update: () => {}, n: 0 }
  const rand = rng(77)
  const cars = instanced(carGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.55 }), count)
  const autos = instanced(autoGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 }), Math.ceil(count / 3))
  const buses = instanced(busGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 }), Math.ceil(count / 5))
  const carColors = ['#c1121f', '#1d4ed8', '#e5e7eb', '#111827', '#9ca3af', '#f59e0b', '#0f766e', '#ffffff']
  const busColors = ['#dc2626', '#2563eb', '#f59e0b', '#16a34a']
  const slots = [0, 0, 0]
  const vehicles: Vehicle[] = []
  const weights = edges.map((e) => (e.arterial ? 5 : 1))
  const wsum = weights.reduce((s, w) => s + w, 0)
  const pickEdge = () => {
    let r = rand() * wsum
    for (let i = 0; i < edges.length; i++) if ((r -= weights[i]) <= 0) return i
    return edges.length - 1
  }
  for (let i = 0; i < count; i++) {
    const roll = rand()
    const kind = roll < 0.6 ? 0 : roll < 0.82 ? 1 : 2
    const cap = [cars.count, autos.count, buses.count][kind]
    if (slots[kind] >= cap) continue
    const e = pickEdge()
    const slot = slots[kind]++
    vehicles.push({ e, dir: rand() < 0.5 ? 1 : -1, s: rand() * edges[e].len, speed: [9 + rand() * 4, 6 + rand() * 2, 7 + rand() * 2][kind], kind, slot })
    const mesh = [cars, autos, buses][kind]
    mesh.setColorAt(slot, new THREE.Color(kind === 1 ? '#ffffff' : kind === 2 ? busColors[Math.floor(rand() * busColors.length)] : carColors[Math.floor(rand() * carColors.length)]))
  }
  cars.count = Math.max(slots[0], 1)
  autos.count = Math.max(slots[1], 1)
  buses.count = Math.max(slots[2], 1)
  group.add(cars, autos, buses)
  const meshes = [cars, autos, buses]
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const sc = new THREE.Vector3(1, 1, 1)

  const update = ({ dt, levelM }: Ctx) => {
    for (const v of vehicles) {
      const e = edges[v.e]
      const mesh = meshes[v.kind]
      if (e.hand <= levelM) {
        mesh.setMatrixAt(v.slot, HIDDEN) // the road is under water
        continue
      }
      v.s += v.speed * SIM_SPEED * dt
      if (v.s >= e.len) {
        const at = v.dir > 0 ? e.b : e.a
        const options = adj[at].filter((i) => i !== v.e && edges[i].hand > levelM)
        if (options.length) {
          const ne = options[Math.floor(Math.random() * options.length)]
          v.e = ne
          v.dir = edges[ne].a === at ? 1 : -1
          v.s = 0
        } else {
          v.dir = v.dir > 0 ? -1 : 1 // dead end or cut road: turn around
          v.s = 0
        }
      }
      const cur = edges[v.e]
      const [ax, az] = xz[cur.a]
      const [bx, bz] = xz[cur.b]
      const t = v.s / cur.len
      const fx = v.dir > 0 ? t : 1 - t
      let dx = bx - ax
      let dz = bz - az
      const dl = Math.hypot(dx, dz) || 1
      dx = (v.dir > 0 ? dx : -dx) / dl
      dz = (v.dir > 0 ? dz : -dz) / dl
      const lane = 1.5 // drive on the left
      p.set(ax + (bx - ax) * fx + dz * lane, 0, az + (bz - az) * fx - dx * lane)
      p.y = fr.y(fr.groundAtXZ(p.x, p.z)) + 0.25
      q.setFromAxisAngle(UP, -Math.atan2(dz, dx))
      m.compose(p, q, sc)
      mesh.setMatrixAt(v.slot, m)
    }
    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true
  }
  return { group, update, n: vehicles.length }
}

/* ---------------------------------------------------------- lamps and poles */

function createStreetFurniture(fr: GeoFrame, layers: Layers) {
  const group = new THREE.Group()
  const rand = rng(31)
  const lampSpots: THREE.Matrix4[] = []
  const poleSpots: THREE.Matrix4[] = []
  const q = new THREE.Quaternion()
  for (const f of layers.roads.features) {
    if (f.properties.bridge) continue
    const cls = String(f.properties.cls)
    const [[lon0, lat0], [lon1, lat1]] = lineLonLat(f)
    const ax = fr.x(lon0), az = fr.z(lat0), bx = fr.x(lon1), bz = fr.z(lat1)
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 12) continue
    const ux = (bx - ax) / len, uz = (bz - az) / len
    const side = rand() < 0.5 ? 1 : -1
    const lamp = ARTERIAL.has(cls)
    const step = lamp ? 42 : 70
    const off = lamp ? 7 : 5
    for (let s = step * rand(); s < len; s += step) {
      const x = ax + ux * s - uz * off * side
      const z = az + uz * s + ux * off * side
      q.setFromAxisAngle(UP, -Math.atan2(uz * -side, ux * -side))
      const mat = new THREE.Matrix4().compose(new THREE.Vector3(x, fr.y(fr.groundAtXZ(x, z)), z), q, new THREE.Vector3(1, 1, 1))
      if (lamp) lampSpots.push(mat)
      else if (rand() < 0.55) poleSpots.push(mat)
    }
  }
  const cap = 6000
  const { pole, head } = lampGeometries()
  const lamps = instanced(pole, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 }), Math.min(lampSpots.length, cap) || 1)
  const heads = instanced(head, new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#fff1b8', emissiveIntensity: 0.9 }), Math.min(lampSpots.length, cap) || 1, false)
  lampSpots.slice(0, cap).forEach((mm, i) => {
    lamps.setMatrixAt(i, mm)
    heads.setMatrixAt(i, mm)
  })
  const poles = instanced(powerPoleGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), Math.min(poleSpots.length, cap) || 1)
  poleSpots.slice(0, cap).forEach((mm, i) => poles.setMatrixAt(i, mm))
  group.add(lamps, heads, poles)
  return { group, lamps: Math.min(lampSpots.length, cap), poles: Math.min(poleSpots.length, cap) }
}

/* ------------------------------------------------------------- river traffic */

function createRiverBoats(fr: GeoFrame, layers: Layers, size: number) {
  const group = new THREE.Group()
  const curves: THREE.CatmullRomCurve3[] = []
  for (const f of layers.river.features) {
    const pts = lineLonLat(f).map(([lon, lat]) => new THREE.Vector3(fr.x(lon), 0, fr.z(lat)))
    if (pts.length > 3) curves.push(new THREE.CatmullRomCurve3(pts))
  }
  if (!curves.length) return { group, update: () => {}, n: 0 }
  const n = 14
  const boats = instanced(boatGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.55 }), n)
  const colors = ['#2563eb', '#b45309', '#15803d', '#be123c', '#475569']
  const rand = rng(5)
  const state = Array.from({ length: n }, (_, i) => ({ c: curves[i % curves.length], u: rand(), speed: (0.004 + rand() * 0.006) * (rand() < 0.5 ? -1 : 1), off: (rand() - 0.5) * 24, scale: Math.max(0.9, size / 5000) }))
  state.forEach((_, i) => boats.setColorAt(i, new THREE.Color(colors[i % colors.length])))
  group.add(boats)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const update = ({ t, dt, waterY }: Ctx) => {
    state.forEach((b, i) => {
      b.u += b.speed * dt
      if (b.u > 1 || b.u < 0) {
        b.speed *= -1
        b.u = Math.min(Math.max(b.u, 0), 1)
      }
      const pt = b.c.getPointAt(b.u)
      const tan = b.c.getTangentAt(b.u).multiplyScalar(Math.sign(b.speed))
      p.set(pt.x - tan.z * b.off, waterY - 0.25 + Math.sin(t * 1.4 + i) * 0.12, pt.z + tan.x * b.off)
      q.setFromAxisAngle(UP, -Math.atan2(tan.z, tan.x))
      m.compose(p, q, new THREE.Vector3(b.scale, b.scale, b.scale))
      boats.setMatrixAt(i, m)
    })
    boats.instanceMatrix.needsUpdate = true
  }
  return { group, update, n }
}

/* ------------------------------------------------------------ sky and animals */

function createSky(size: number) {
  const group = new THREE.Group()
  const rand = rng(8)
  const clouds: { s: THREE.Sprite; v: number }[] = []
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTexture(i + 1), transparent: true, opacity: 0.85, depthWrite: false, fog: false })
    const s = new THREE.Sprite(mat)
    const w = size * (0.22 + rand() * 0.22)
    s.scale.set(w, w * 0.5, 1)
    s.position.set((rand() - 0.5) * size * 1.8, size * (0.22 + rand() * 0.1), (rand() - 0.5) * size * 1.8)
    clouds.push({ s, v: 2 + rand() * 4 })
    group.add(s)
  }
  const nBirds = 60
  const birds = instanced(birdGeometry(), new THREE.MeshBasicMaterial({ color: '#1f2937', side: THREE.DoubleSide }), nBirds, false)
  const flocks = Array.from({ length: 6 }, () => ({ cx: (rand() - 0.5) * size * 0.8, cz: (rand() - 0.5) * size * 0.8, r: 90 + rand() * 260, h: 70 + rand() * 140, w: 0.12 + rand() * 0.1 }))
  const bs = Array.from({ length: nBirds }, (_, i) => ({ f: i % flocks.length, ph: rand() * 6.28, dr: (rand() - 0.5) * 60, dh: (rand() - 0.5) * 30 }))
  group.add(birds)
  const heli = helicopterGroup()
  const hs = Math.max(2.2, size / 3500)
  heli.scale.setScalar(hs)
  group.add(heli)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const update = ({ t, dt }: Ctx) => {
    for (const c of clouds) {
      c.s.position.x += c.v * dt
      if (c.s.position.x > size) c.s.position.x = -size
    }
    bs.forEach((b, i) => {
      const fl = flocks[b.f]
      const a = t * fl.w + b.ph * 0.05 + b.f
      const r = fl.r + b.dr
      p.set(fl.cx + Math.cos(a) * r, fl.h + b.dh + Math.sin(t * 0.7 + i) * 4, fl.cz + Math.sin(a) * r)
      q.setFromAxisAngle(UP, -(a + Math.PI / 2))
      const flap = 0.55 + 0.45 * Math.sin(t * 9 + b.ph)
      m.compose(p, q, new THREE.Vector3(2.2, flap, 2.2))
      birds.setMatrixAt(i, m)
    })
    birds.instanceMatrix.needsUpdate = true
    const a = t * 0.12
    const R = size * 0.16
    heli.position.set(Math.cos(a) * R, size * 0.025 + Math.sin(t * 0.5) * 6, Math.sin(a) * R)
    heli.rotation.y = -(a + Math.PI / 2)
    heli.rotation.z = 0.12
    heli.getObjectByName('rotor')!.rotation.y += dt * 38
    heli.getObjectByName('tailRotor')!.rotation.z += dt * 50
  }
  return { group, update, n: nBirds + clouds.length + 1 }
}

function createCattle(fr: GeoFrame, layers: Layers, size: number) {
  const rand = rng(23)
  const cell = 22
  const busy = new Set<string>()
  for (const f of layers.roads.features) {
    for (const [lon, lat] of lineLonLat(f)) busy.add(`${Math.floor(fr.x(lon) / cell)},${Math.floor(fr.z(lat) / cell)}`)
  }
  const spots: THREE.Matrix4[] = []
  const half = size / 2
  for (let tries = 0; spots.length < 140 && tries < 6000; tries++) {
    const x = (rand() * 2 - 1) * half
    const z = (rand() * 2 - 1) * half
    if (busy.has(`${Math.floor(x / cell)},${Math.floor(z / cell)}`)) continue
    const h = fr.groundAtXZ(x, z)
    if (h < 0.9 || h > 6) continue // grazing on the flood plain, away from the water
    const herd = 1 + Math.floor(rand() * 3)
    for (let k = 0; k < herd && spots.length < 140; k++) {
      const px = x + (rand() - 0.5) * 18
      const pz = z + (rand() - 0.5) * 18
      const q = new THREE.Quaternion().setFromAxisAngle(UP, rand() * Math.PI * 2)
      spots.push(new THREE.Matrix4().compose(new THREE.Vector3(px, fr.y(fr.groundAtXZ(px, pz)), pz), q, new THREE.Vector3(1.15, 1.15, 1.15)))
    }
  }
  const cows = instanced(cowGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), spots.length || 1)
  const tint = ['#ffffff', '#c8a57a', '#7a5a3a', '#e8e1d2', '#3a2f28']
  spots.forEach((mm, i) => {
    cows.setMatrixAt(i, mm)
    cows.setColorAt(i, new THREE.Color(tint[Math.floor(rand() * tint.length)]))
  })
  const group = new THREE.Group()
  group.add(cows)
  return { group, n: spots.length }
}

/* ------------------------------------------------------- crowds and debris */

/** People waiting around relief shelters, drifting slowly in small loops. */
function createCrowds(shelters: THREE.Vector3[], capacities: number[], fr: GeoFrame) {
  const group = new THREE.Group()
  if (!shelters.length) return { group, update: () => {}, n: 0 }
  const rand = rng(91)
  const max = 420
  const mesh = instanced(personGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.8 }), max)
  const clothes = ['#b91c1c', '#1d4ed8', '#f59e0b', '#047857', '#7c3aed', '#f1f5f9', '#db2777', '#0f766e']
  const total = capacities.reduce((s, c) => s + c, 0) || 1
  const people: { c: THREE.Vector3; r: number; w: number; ph: number }[] = []
  shelters.forEach((c, i) => {
    const n = Math.round((capacities[i] / total) * max)
    for (let k = 0; k < n && people.length < max; k++) people.push({ c, r: 9 + rand() * 18, w: (0.15 + rand() * 0.25) * (rand() < 0.5 ? -1 : 1), ph: rand() * 6.28 })
  })
  people.forEach((_, i) => mesh.setColorAt(i, new THREE.Color(clothes[i % clothes.length])))
  mesh.count = Math.max(people.length, 1)
  group.add(mesh)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const sc = new THREE.Vector3(1.35, 1.35, 1.35)
  const update = ({ t }: Ctx) => {
    people.forEach((pp, i) => {
      const a = t * pp.w + pp.ph
      p.set(pp.c.x + Math.cos(a) * pp.r, 0, pp.c.z + Math.sin(a) * pp.r)
      p.y = fr.y(fr.groundAtXZ(p.x, p.z)) + 0.2
      q.setFromAxisAngle(UP, -(a + Math.PI / 2 * Math.sign(pp.w)))
      m.compose(p, q, sc)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
  return { group, update, n: people.length }
}

/** Logs, drums and crates drifting on the flood water; visible only where the ground is under water. */
function createDebris(fr: GeoFrame, size: number) {
  const group = new THREE.Group()
  const rand = rng(404)
  const n = 160
  const geo = new THREE.BoxGeometry(2.4, 0.5, 0.6)
  const mesh = instanced(geo, new THREE.MeshStandardMaterial({ color: '#6b5a47', roughness: 0.95 }), n, false)
  const half = size / 2
  const items = Array.from({ length: n }, () => ({ x: (rand() * 2 - 1) * half * 0.7, z: (rand() * 2 - 1) * half * 0.7, vx: (rand() - 0.5) * 1.6, vz: (rand() - 0.5) * 1.6, rot: rand() * 6.28, s: 0.7 + rand() * 1.6 }))
  group.add(mesh)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const update = ({ t, dt, waterY, levelM }: Ctx) => {
    items.forEach((d, i) => {
      d.x += d.vx * dt
      d.z += d.vz * dt
      if (Math.abs(d.x) > half) d.x = -d.x
      if (Math.abs(d.z) > half) d.z = -d.z
      const g = fr.groundAtXZ(d.x, d.z)
      if (levelM < 0.6 || g > levelM - 0.15) {
        mesh.setMatrixAt(i, HIDDEN)
        return
      }
      p.set(d.x, waterY + 0.05 + Math.sin(t * 1.6 + i) * 0.08, d.z)
      q.setFromAxisAngle(UP, d.rot + Math.sin(t * 0.3 + i) * 0.2)
      m.compose(p, q, new THREE.Vector3(d.s, d.s, d.s))
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
  return { group, update, n }
}

/* --------------------------------------------------------------------- all */

export function createLife(fr: GeoFrame, layers: Layers, size: number, shelterPos: THREE.Vector3[], shelterCap: number[]): Life {
  const group = new THREE.Group()
  const traffic = createTraffic(fr, layers, Math.min(Math.max(Math.round(layers.roads.features.length / 12), 40), 420))
  const furniture = createStreetFurniture(fr, layers)
  const boats = createRiverBoats(fr, layers, size)
  const sky = createSky(size)
  const cattle = createCattle(fr, layers, size)
  const crowds = createCrowds(shelterPos, shelterCap, fr)
  const debris = createDebris(fr, size)
  group.add(traffic.group, furniture.group, boats.group, sky.group, cattle.group, crowds.group, debris.group)
  return {
    group,
    update: (c) => {
      traffic.update(c)
      boats.update(c)
      sky.update(c)
      crowds.update(c)
      debris.update(c)
    },
    counts: {
      vehicles: traffic.n,
      'street lamps': furniture.lamps,
      'power poles': furniture.poles,
      'boats on the river': boats.n,
      cattle: cattle.n,
      'people at shelters': crowds.n,
      'birds, clouds and a rescue helicopter': sky.n,
    },
  }
}
