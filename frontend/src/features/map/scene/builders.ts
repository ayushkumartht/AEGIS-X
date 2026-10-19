import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Building, GeoFeature, Layers } from '@/api/types'
import { GeoFrame, lineLonLat, rng, tileX, tileY } from './geo'
import type { Satellite } from './satellite'

const ROAD_WIDTH: Record<string, number> = { trunk: 11, primary: 10, secondary: 8.5, tertiary: 7, unclassified: 6, residential: 4.5 }
const ROAD_COLOR: Record<string, string> = { trunk: '#2f3237', primary: '#33363b', secondary: '#3a3c40', tertiary: '#45464a', unclassified: '#55524d', residential: '#5e5a53' }

/** Ground mesh: satellite imagery draped when available, otherwise a natural colour ramp. */
export const TERRAIN_PAD = 0.35 // ground extends this share beyond the data on each side, fading into the haze

export function paddedBounds(bounds: [number, number, number, number]): [number, number, number, number] {
  const dx = (bounds[2] - bounds[0]) * TERRAIN_PAD
  const dy = (bounds[3] - bounds[1]) * TERRAIN_PAD
  return [bounds[0] - dx, bounds[1] - dy, bounds[2] + dx, bounds[3] + dy]
}

export function terrainMesh(fr: GeoFrame, sat: Satellite | null): THREE.Mesh {
  const { bounds, max } = fr.t
  const n = Math.round(fr.t.n * (1 + 2 * TERRAIN_PAD))
  const pad = TERRAIN_PAD
  const lonA = bounds[0] - (bounds[2] - bounds[0]) * pad
  const lonB = bounds[2] + (bounds[2] - bounds[0]) * pad
  const latA = bounds[1] - (bounds[3] - bounds[1]) * pad
  const latB = bounds[3] + (bounds[3] - bounds[1]) * pad
  const pos = new Float32Array(n * n * 3)
  const uv = new Float32Array(n * n * 2)
  const col = new Float32Array(n * n * 3)
  const low = new THREE.Color('#9fa77a')
  const high = new THREE.Color('#4d6b3b')
  const tmp = new THREE.Color()
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c
      const lon = lonA + ((lonB - lonA) * c) / (n - 1)
      const lat = latA + ((latB - latA) * r) / (n - 1)
      const h = fr.ground(lon, lat)
      pos.set([fr.x(lon), fr.y(h), fr.z(lat)], i * 3)
      if (sat) {
        uv[i * 2] = (tileX(lon, sat.z) - sat.x0) / sat.nx
        uv[i * 2 + 1] = 1 - (tileY(lat, sat.z) - sat.y0) / sat.ny
      }
      tmp.copy(low).lerp(high, Math.min(h / Math.max(max, 1), 1))
      col.set([tmp.r, tmp.g, tmp.b], i * 3)
    }
  }
  const idx: number[] = []
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const a = r * n + c
      idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const mat = sat
    ? new THREE.MeshStandardMaterial({ map: sat.texture, roughness: 0.95, metalness: 0 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  const mesh = new THREE.Mesh(g, mat)
  mesh.receiveShadow = true
  return mesh
}

/** Road ribbons on the ground. Returns the mesh and, per road edge, its vertex range for recolouring. */
export function roadMesh(fr: GeoFrame, roads: GeoFeature[]) {
  const parts: number[] = []
  const colors: number[] = []
  const edgeOf: number[] = []
  const baseColor: THREE.Color[] = []
  const tmp = new THREE.Color()
  for (const f of roads) {
    if (f.properties.bridge) continue
    const [[lon0, lat0], [lon1, lat1]] = lineLonLat(f)
    const a = fr.point(lon0, lat0, 0.25 * fr.vex + 0.15)
    const b = fr.point(lon1, lat1, 0.25 * fr.vex + 0.15)
    const dir = new THREE.Vector3().subVectors(b, a).setY(0)
    if (dir.lengthSq() < 0.01) continue
    const cls = String(f.properties.cls)
    const w = (ROAD_WIDTH[cls] ?? 5) / 2
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(w)
    const q = [a.clone().add(side), a.clone().sub(side), b.clone().add(side), b.clone().sub(side)]
    for (const v of [q[0], q[2], q[1], q[1], q[2], q[3]]) parts.push(v.x, v.y, v.z)
    tmp.set(ROAD_COLOR[cls] ?? '#55524d')
    for (let k = 0; k < 6; k++) colors.push(tmp.r, tmp.g, tmp.b)
    edgeOf.push(Number(f.properties.i))
    baseColor.push(tmp.clone())
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(parts, 3))
  const colorAttr = new THREE.Float32BufferAttribute(colors, 3)
  g.setAttribute('color', colorAttr)
  g.computeVertexNormals()
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }))
  mesh.receiveShadow = true
  return { mesh, colorAttr, edgeOf, baseColor }
}

/** Concrete bridge decks with railings and piers at their real deck height. */
export function bridgeGroup(fr: GeoFrame, layers: Layers) {
  const group = new THREE.Group()
  const byKey = new Map<string, THREE.Object3D[]>()
  const concrete = new THREE.MeshStandardMaterial({ color: '#b9b3a8', roughness: 0.75 })
  const asphalt = new THREE.MeshStandardMaterial({ color: '#2f3237', roughness: 0.8 })
  const rail = new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.6 })
  const name = new Map(layers.bridges.map((b) => [b.id, b.name]))
  for (const f of layers.roads.features.filter((x) => x.properties.bridge)) {
    const [[lon0, lat0], [lon1, lat1]] = lineLonLat(f)
    const key = String(f.properties.key || '')
    const a = new THREE.Vector3(fr.x(lon0), 0, fr.z(lat0))
    const b = new THREE.Vector3(fr.x(lon1), 0, fr.z(lat1))
    const len = a.distanceTo(b)
    if (len < 1) continue
    const deckY = fr.y(Number(f.properties.hand))
    const width = key ? 11 : 7
    const seg = new THREE.Group()
    seg.position.set((a.x + b.x) / 2, deckY, (a.z + b.z) / 2)
    seg.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(len + 1, 1.6, width), concrete)
    const top = new THREE.Mesh(new THREE.BoxGeometry(len + 1, 0.2, width - 1.4), asphalt)
    top.position.y = 0.85
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(len + 1, 1.1, 0.35), rail)
    r1.position.set(0, 1.4, width / 2 - 0.2)
    const r2 = r1.clone()
    r2.position.z = -width / 2 + 0.2
    for (const m of [slab, top, r1, r2]) {
      m.castShadow = true
      m.receiveShadow = true
      m.userData = key ? { kind: 'bridge', id: key, name: name.get(key) ?? key, deckM: Number(f.properties.hand) } : {}
      seg.add(m)
    }
    group.add(seg)
    const piers = Math.max(2, Math.round(len / 28) + 1)
    for (let p = 0; p < piers; p++) {
      const t = p / (piers - 1)
      const lon = lon0 + (lon1 - lon0) * t
      const lat = lat0 + (lat1 - lat0) * t
      const g = fr.y(fr.ground(lon, lat)) - 2
      const h = Math.max(deckY - 0.8 - g, 0.5)
      const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, h, width * 0.7), concrete)
      pier.position.set(fr.x(lon), g + h / 2, fr.z(lat))
      pier.rotation.y = seg.rotation.y
      pier.castShadow = true
      group.add(pier)
    }
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), seg])
  }
  return { group, byKey }
}

const WALLS = ['#efe9dd', '#e6dccb', '#d9e3e8', '#f1d9c9', '#e8e2b8', '#d7d1c7', '#f3f0ea', '#cfd8c4']
const ROOFS = ['#7b828a', '#8e4a36', '#4e6f94', '#6d7a5a', '#9aa0a6', '#a35c3d']

/** Illustrative houses along residential streets, sized to the population; plus mapped buildings. */
export function housesMesh(fr: GeoFrame, layers: Layers, mapped: Building[], seed = 11) {
  const rand = rng(seed)
  const streets = layers.roads.features.filter((f) => ['residential', 'unclassified', 'tertiary'].includes(String(f.properties.cls)) && !f.properties.bridge)
  const totalLen = streets.reduce((s, f) => {
    const [[a, b], [c, d]] = lineLonLat(f)
    return s + Math.hypot(fr.x(a) - fr.x(c), fr.z(b) - fr.z(d))
  }, 0)
  const population = layers.totals.population
  const target = Math.min(Math.round(population / 5), 24000)
  const spacing = Math.max(9, (2 * totalLen) / Math.max(target, 1))

  const bodies: THREE.Matrix4[] = []
  const roofs: THREE.Matrix4[] = []
  const wallColors: THREE.Color[] = []
  const roofColors: THREE.Color[] = []
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  for (const f of streets) {
    const [[lon0, lat0], [lon1, lat1]] = lineLonLat(f)
    const ax = fr.x(lon0), az = fr.z(lat0), bx = fr.x(lon1), bz = fr.z(lat1)
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 4) continue
    const ux = (bx - ax) / len, uz = (bz - az) / len
    const angle = -Math.atan2(uz, ux)
    for (let s = spacing * rand(); s < len; s += spacing * (0.7 + 0.6 * rand())) {
      for (const sideSign of [1, -1]) {
        if (rand() < 0.15) continue
        const w = 6 + rand() * 6
        const d = 6 + rand() * 7
        const off = 4 + d / 2 + rand() * 4
        const px = ax + ux * s - uz * off * sideSign
        const pz = az + uz * s + ux * off * sideSign
        const ground = fr.y(fr.groundAtXZ(px, pz))
        const floors = rand() < 0.65 ? 1 : rand() < 0.8 ? 2 : 3
        const h = floors * 3.1 * fr.vex
        quat.setFromAxisAngle(up, angle + (rand() - 0.5) * 0.12)
        pos.set(px, ground, pz)
        bodies.push(new THREE.Matrix4().compose(pos.clone(), quat.clone(), new THREE.Vector3(w, h, d)))
        wallColors.push(new THREE.Color(WALLS[Math.floor(rand() * WALLS.length)]))
        if (floors === 1 || rand() < 0.4) {
          pos.set(px, ground + h, pz)
          roofs.push(new THREE.Matrix4().compose(pos.clone(), quat.clone(), new THREE.Vector3(w * 1.08, 1.8 * fr.vex, d * 1.08)))
          roofColors.push(new THREE.Color(ROOFS[Math.floor(rand() * ROOFS.length)]))
        }
      }
    }
  }

  const bodyGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const body = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), bodies.length)
  bodies.forEach((m, i) => {
    body.setMatrixAt(i, m)
    body.setColorAt(i, wallColors[i])
  })
  const roofGeo = gableGeometry()
  const roof = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.35 }), roofs.length)
  roofs.forEach((m, i) => {
    roof.setMatrixAt(i, m)
    roof.setColorAt(i, roofColors[i])
  })
  for (const m of [body, roof]) {
    m.castShadow = true
    m.receiveShadow = true
  }

  const group = new THREE.Group()
  group.add(body, roof)
  const mappedMesh = mappedBuildings(fr, mapped)
  if (mappedMesh) group.add(mappedMesh)
  return { group, count: bodies.length, mapped: mapped.length }
}

/** Unit gable roof: ridge along x, base 1 x 1, height 1, sitting on y = 0. */
function gableGeometry(): THREE.BufferGeometry {
  const v = [
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, 0, -0.5, 0, -0.5, 0.5, 1, 0, -0.5, 1, 0,
    -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, 0.5, 0, 0.5,
    -0.5, 0, -0.5, -0.5, 1, 0, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 1, 0,
  ]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  g.computeVertexNormals()
  return g
}

function mappedBuildings(fr: GeoFrame, mapped: Building[]): THREE.Mesh | null {
  const geos: THREE.BufferGeometry[] = []
  for (const b of mapped) {
    const pts = b.ring.map(([lon, lat]) => new THREE.Vector2(fr.x(lon), -fr.z(lat)))
    if (pts.length < 4) continue
    const shape = new THREE.Shape(pts)
    const levels = b.levels ?? (b.kind === 'house' ? 1 : 2)
    const cx = b.ring.reduce((s, p) => s + p[0], 0) / b.ring.length
    const cy = b.ring.reduce((s, p) => s + p[1], 0) / b.ring.length
    const geo = new THREE.ExtrudeGeometry(shape, { depth: levels * 3.2 * fr.vex, bevelEnabled: false })
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, fr.y(fr.ground(cx, cy)), 0)
    geos.push(geo)
  }
  if (!geos.length) return null
  const merged = mergeGeometries(geos)
  geos.forEach((g) => g.dispose())
  if (!merged) return null
  const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: '#e9e4da', roughness: 0.8 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** Trees scattered away from streets and houses. */
export function treesMesh(fr: GeoFrame, layers: Layers, count: number, seed = 5) {
  const rand = rng(seed)
  const cell = 25
  const busy = new Set<string>()
  for (const f of layers.roads.features) {
    for (const [lon, lat] of lineLonLat(f)) {
      const gx = Math.floor(fr.x(lon) / cell), gz = Math.floor(fr.z(lat) / cell)
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) busy.add(`${gx + dx},${gz + dz}`)
    }
  }
  const half = fr.size / 2
  const trunks: THREE.Matrix4[] = []
  const crowns: THREE.Matrix4[] = []
  const shades: THREE.Color[] = []
  for (let tries = 0; trunks.length < count && tries < count * 8; tries++) {
    const x = (rand() * 2 - 1) * half
    const z = (rand() * 2 - 1) * half
    if (busy.has(`${Math.floor(x / cell)},${Math.floor(z / cell)}`)) continue
    const g = fr.y(fr.groundAtXZ(x, z))
    const s = 0.7 + rand() * 0.8
    const h = (5 + rand() * 6) * s
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, g, z), new THREE.Quaternion(), new THREE.Vector3(s, h * fr.vex * 0.45, s)))
    crowns.push(new THREE.Matrix4().compose(new THREE.Vector3(x, g + h * fr.vex * 0.45, z), new THREE.Quaternion(), new THREE.Vector3(3.2 * s, 3.2 * s * fr.vex * 0.6, 3.2 * s)))
    shades.push(new THREE.Color().setHSL(0.24 + rand() * 0.08, 0.45, 0.22 + rand() * 0.12))
  }
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1, 5).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 1 }), trunks.length)
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0).translate(0, 0.7, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), crowns.length)
  trunks.forEach((m, i) => trunk.setMatrixAt(i, m))
  crowns.forEach((m, i) => {
    crown.setMatrixAt(i, m)
    crown.setColorAt(i, shades[i])
  })
  crown.castShadow = true
  const group = new THREE.Group()
  group.add(trunk, crown)
  return group
}

/** A tiling normal map for the water surface, generated from layered sine noise. */
export function waterNormals(): THREE.Texture {
  const size = 256
  const h = new Float32Array(size * size)
  const waves = Array.from({ length: 18 }, (_, i) => ({ kx: Math.round(Math.cos(i * 2.3) * (2 + i)), ky: Math.round(Math.sin(i * 2.3) * (2 + i)), a: 1 / (1 + i * 0.6), p: i * 1.7 }))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0
      for (const w of waves) v += w.a * Math.sin(((w.kx * x + w.ky * y) / size) * Math.PI * 2 + w.p)
      h[y * size + x] = v
    }
  }
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)]
      const dy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x]
      const nrm = new THREE.Vector3(-dx, -dy, 2.5).normalize()
      const i = (y * size + x) * 4
      data[i] = (nrm.x * 0.5 + 0.5) * 255
      data[i + 1] = (nrm.y * 0.5 + 0.5) * 255
      data[i + 2] = (nrm.z * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

