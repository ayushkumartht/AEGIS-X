import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Building, GeoFeature, Layers } from '@/api/types'
import { GeoFrame, lineLonLat, rng, tileX, tileY } from './geo'
import type { Satellite } from './satellite'
import { groundTexture, roadTexture, roofTexture, wallTexture } from './textures'

export const TERRAIN_PAD = 0.35 // ground extends this share beyond the data on each side, fading into the haze

export function paddedBounds(bounds: [number, number, number, number]): [number, number, number, number] {
  const dx = (bounds[2] - bounds[0]) * TERRAIN_PAD
  const dy = (bounds[3] - bounds[1]) * TERRAIN_PAD
  return [bounds[0] - dx, bounds[1] - dy, bounds[2] + dx, bounds[3] + dy]
}

const box1 = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)

/* ---------------------------------------------------------------- ground */

/** Ground mesh: satellite imagery when available, otherwise a detailed grass and soil texture. */
export function terrainMesh(fr: GeoFrame, sat: Satellite | null): THREE.Mesh {
  const { bounds, max } = fr.t
  const n = Math.round(fr.t.n * (1 + 2 * TERRAIN_PAD))
  const [lonA, latA, lonB, latB] = paddedBounds(bounds)
  const pos = new Float32Array(n * n * 3)
  const uv = new Float32Array(n * n * 2)
  const col = new Float32Array(n * n * 3)
  const low = new THREE.Color('#c9c3a0')
  const high = new THREE.Color('#9aa76f')
  const bed = new THREE.Color('#8a7a5a')
  const tmp = new THREE.Color()
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c
      const lon = lonA + ((lonB - lonA) * c) / (n - 1)
      const lat = latA + ((latB - latA) * r) / (n - 1)
      const h = fr.ground(lon, lat)
      const x = fr.x(lon)
      const z = fr.z(lat)
      pos.set([x, fr.y(h), z], i * 3)
      if (sat) {
        uv[i * 2] = (tileX(lon, sat.z) - sat.x0) / sat.nx
        uv[i * 2 + 1] = 1 - (tileY(lat, sat.z) - sat.y0) / sat.ny
        col.set([1, 1, 1], i * 3)
      } else {
        uv[i * 2] = x / 60
        uv[i * 2 + 1] = z / 60
        tmp.copy(low).lerp(high, Math.min(h / Math.max(max * 0.35, 1), 1))
        if (h < 0.6) tmp.lerp(bed, 0.6)
        col.set([tmp.r, tmp.g, tmp.b], i * 3)
      }
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
  const mat = new THREE.MeshStandardMaterial({ map: sat ? sat.texture : groundTexture(), vertexColors: true, roughness: 0.95, metalness: 0 })
  const mesh = new THREE.Mesh(g, mat)
  mesh.receiveShadow = true
  return mesh
}

/* ----------------------------------------------------------------- roads */

const ROAD_WIDTH: Record<string, number> = { trunk: 11, primary: 10, secondary: 8.5, tertiary: 7, unclassified: 6, residential: 5 }
const ROAD_TINT: Record<string, string> = { trunk: '#d0d0d0', primary: '#d6d6d6', secondary: '#dddddd', tertiary: '#e6e3dc', unclassified: '#efe7d6', residential: '#f3ead8' }

/** Asphalt ribbons with lane markings. Returns per-edge colour slots so cut roads can be tinted. */
export function roadMesh(fr: GeoFrame, roads: GeoFeature[]) {
  const P: number[] = []
  const U: number[] = []
  const Cl: number[] = []
  const edgeOf: number[] = []
  const baseColor: THREE.Color[] = []
  for (const f of roads) {
    if (f.properties.bridge) continue
    const [[lon0, lat0], [lon1, lat1]] = lineLonLat(f)
    const a = fr.point(lon0, lat0, 0.18)
    const b = fr.point(lon1, lat1, 0.18)
    const dir = new THREE.Vector3().subVectors(b, a).setY(0)
    const len = dir.length()
    if (len < 0.5) continue
    const cls = String(f.properties.cls)
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar((ROAD_WIDTH[cls] ?? 5) / 2)
    const q = [a.clone().add(side), a.clone().sub(side), b.clone().add(side), b.clone().sub(side)]
    const v = len / 14
    const uvq = [[0, 0], [1, 0], [0, v], [1, v]]
    for (const k of [0, 2, 1, 1, 2, 3]) {
      P.push(q[k].x, q[k].y, q[k].z)
      U.push(uvq[k][0], uvq[k][1])
    }
    const tint = new THREE.Color(ROAD_TINT[cls] ?? '#e6e3dc')
    for (let k = 0; k < 6; k++) Cl.push(tint.r, tint.g, tint.b)
    edgeOf.push(Number(f.properties.i))
    baseColor.push(tint)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2))
  const colorAttr = new THREE.Float32BufferAttribute(Cl, 3)
  g.setAttribute('color', colorAttr)
  g.computeVertexNormals()
  const mesh = new THREE.Mesh(
    g,
    new THREE.MeshStandardMaterial({ map: roadTexture(), vertexColors: true, roughness: 0.82, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  )
  mesh.receiveShadow = true
  return { mesh, colorAttr, edgeOf, baseColor }
}

/* --------------------------------------------------------------- bridges */

/**
 * Road bridges: concrete deck with edge beams, asphalt and lane marks, railing posts and rails,
 * street lamps, approach ramps, and twin-column piers with caps standing on the river bed.
 */
export function bridgeGroup(fr: GeoFrame, layers: Layers) {
  const group = new THREE.Group()
  const byKey = new Map<string, THREE.Object3D[]>()
  const concrete = new THREE.MeshStandardMaterial({ color: '#bdb7ab', roughness: 0.8 })
  const darkConcrete = new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 0.9 })
  const asphalt = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.8 })
  const steel = new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.4, metalness: 0.6 })
  const lampMat = new THREE.MeshStandardMaterial({ color: '#fff7d6', emissive: '#ffe9a8', emissiveIntensity: 1.2 })
  const name = new Map(layers.bridges.map((b) => [b.id, b.name]))
  const posts: THREE.Matrix4[] = []
  const up = new THREE.Vector3(0, 1, 0)

  for (const f of layers.roads.features.filter((x) => x.properties.bridge)) {
    const [[lon0, lat0], [lon1, lat1]] = lineLonLat(f)
    const key = String(f.properties.key || '')
    const ax = fr.x(lon0), az = fr.z(lat0), bx = fr.x(lon1), bz = fr.z(lat1)
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 1) continue
    const gA = fr.y(fr.ground(lon0, lat0))
    const gB = fr.y(fr.ground(lon1, lat1))
    const deckY = Math.max(fr.y(Number(f.properties.hand)), gA + 1, gB + 1)
    const width = key ? 12 : 8
    const angle = -Math.atan2(bz - az, bx - ax)
    const seg = new THREE.Group()
    seg.position.set((ax + bx) / 2, deckY, (az + bz) / 2)
    seg.rotation.y = angle

    const tag = key ? { kind: 'bridge', id: key, name: name.get(key) ?? key, deckM: Number(f.properties.hand) } : {}
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x, y, z)
      m.castShadow = true
      m.receiveShadow = true
      m.userData = tag
      seg.add(m)
    }
    add(new THREE.BoxGeometry(len + 0.5, 1.3, width), concrete, 0, -0.65, 0)
    add(new THREE.BoxGeometry(len + 0.5, 0.9, 0.6), darkConcrete, 0, -1.4, width / 2 - 0.3)
    add(new THREE.BoxGeometry(len + 0.5, 0.9, 0.6), darkConcrete, 0, -1.4, -width / 2 + 0.3)
    const top = new THREE.PlaneGeometry(len + 0.5, width - 1.6).rotateX(-Math.PI / 2)
    const uv = top.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i)
      uv.setXY(i, uv.getY(i), u * ((len + 0.5) / 14))
    }
    add(top, asphalt, 0, 0.02, 0)
    for (const s of [1, -1]) {
      add(new THREE.BoxGeometry(len + 0.5, 0.35, 0.7), concrete, 0, 0.18, s * (width / 2 - 0.35))
      add(new THREE.BoxGeometry(len + 0.5, 0.12, 0.12), steel, 0, 1.15, s * (width / 2 - 0.25))
      add(new THREE.BoxGeometry(len + 0.5, 0.1, 0.1), steel, 0, 0.7, s * (width / 2 - 0.25))
    }
    const rot = new THREE.Quaternion().setFromAxisAngle(up, angle)
    for (let s = -len / 2; s <= len / 2; s += 2.5) {
      for (const side of [1, -1]) {
        const wp = new THREE.Vector3(s, 0.35, side * (width / 2 - 0.25)).applyQuaternion(rot).add(seg.position)
        posts.push(new THREE.Matrix4().compose(wp, rot, new THREE.Vector3(0.12, 0.85, 0.12)))
      }
    }
    for (let s = -len / 2 + 6, k = 0; s < len / 2; s += 28, k++) {
      const side = k % 2 === 0 ? 1 : -1
      add(new THREE.CylinderGeometry(0.09, 0.12, 7, 6).translate(0, 3.5, 0), steel, s, 0.3, side * (width / 2 - 0.3))
      add(new THREE.BoxGeometry(0.1, 0.1, 1.6), steel, s, 7.2, side * (width / 2 - 1.0))
      add(new THREE.BoxGeometry(0.5, 0.18, 0.35), lampMat, s, 7.05, side * (width / 2 - 1.7))
    }
    group.add(seg)

    // approach ramps where the deck stands above the bank
    const dirx = (bx - ax) / len, dirz = (bz - az) / len
    for (const [gx, gz, gy, sign] of [[ax, az, gA, -1], [bx, bz, gB, 1]] as const) {
      const rise = deckY - gy
      if (rise < 0.6) continue
      const rampLen = Math.min(rise * 12, 60)
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 1, width), concrete)
      ramp.position.set(gx + sign * dirx * (rampLen / 2), gy + rise / 2 - 0.5, gz + sign * dirz * (rampLen / 2))
      ramp.rotation.set(0, angle, -sign * Math.atan2(rise, rampLen), 'YXZ')
      ramp.castShadow = true
      ramp.receiveShadow = true
      group.add(ramp)
    }

    // twin-column piers on the river bed, every ~30 m
    const piers = Math.max(2, Math.round(len / 30) + 1)
    for (let p = 0; p < piers; p++) {
      const t = p / (piers - 1)
      const lon = lon0 + (lon1 - lon0) * t
      const lat = lat0 + (lat1 - lat0) * t
      const g = fr.y(fr.ground(lon, lat)) - 1.5
      const h = Math.max(deckY - 2.1 - g, 0.5)
      for (const side of [-1, 1]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, h, 14), concrete)
        const off = new THREE.Vector3(0, 0, side * width * 0.28).applyQuaternion(rot)
        col.position.set(fr.x(lon) + off.x, g + h / 2, fr.z(lat) + off.z)
        col.castShadow = true
        group.add(col)
      }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, width * 0.85), darkConcrete)
      cap.position.set(fr.x(lon), deckY - 1.9, fr.z(lat))
      cap.rotation.y = angle
      cap.castShadow = true
      group.add(cap)
    }
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), seg])
  }
  if (posts.length) {
    const inst = new THREE.InstancedMesh(box1(), steel, posts.length)
    posts.forEach((m, i) => inst.setMatrixAt(i, m))
    inst.castShadow = true
    group.add(inst)
  }
  return { group, byKey }
}

/* ---------------------------------------------------------------- houses */

const PLASTER = ['#f3eee4', '#efe3cc', '#e3ecef', '#f4dccb', '#ece6bf', '#e2dcd2', '#f6f4ef', '#dde6d3', '#f1d6d6', '#d9e4f2']
const TIN = ['#8d949c', '#9a5a41', '#4f7398', '#6f8060', '#a9adb2', '#b0603e', '#3f6e7a']
const TANK = ['#1f2326', '#2b3a55', '#1f2326', '#3a3a3a']
const RISE = 0.55 // gable roof rise, relative to wall height

/** Single storey body with gable ends (ridge along x). Unit size; walls 0..1, gables up to 1 + RISE. */
function gableBodyGeometry(): THREE.BufferGeometry {
  const tri = new THREE.BufferGeometry()
  const v = [0.5, 1, -0.5, 0.5, 1 + RISE, 0, 0.5, 1, 0.5, -0.5, 1, 0.5, -0.5, 1 + RISE, 0, -0.5, 1, -0.5]
  tri.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0.1, 0.9, 0.2, 0.98, 0.3, 0.9, 0.1, 0.9, 0.2, 0.98, 0.3, 0.9], 2))
  tri.computeVertexNormals()
  const body = box1().toNonIndexed()
  body.deleteAttribute('normal')
  body.computeVertexNormals()
  return mergeGeometries([body, tri])!
}

/** Two roof slopes with eave overhang; ridge along x. */
function gableRoofGeometry(): THREE.BufferGeometry {
  const oh = 0.1
  const top = 1 + RISE + 0.03
  const x0 = -0.5 - oh, x1 = 0.5 + oh
  const z = 0.5 + oh
  const ey = 1 - 0.02 - (oh * RISE) / 0.5
  const v = [
    x0, ey, z, x1, ey, z, x1, top, 0, x0, ey, z, x1, top, 0, x0, top, 0,
    x1, ey, -z, x0, ey, -z, x0, top, 0, x1, ey, -z, x0, top, 0, x1, top, 0,
  ]
  const uv = [0, 0, 3, 0, 3, 1, 0, 0, 3, 1, 0, 1, 0, 0, 3, 0, 3, 1, 0, 0, 3, 1, 0, 1]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

/**
 * Houses along residential streets, about one per five people: single-storey Assam-type houses
 * with tin gable roofs on a raised plinth, and one to three storey RCC houses with flat roofs,
 * parapets and water tanks. Illustrative placement, not surveyed footprints; plus OSM buildings.
 */
export function housesMesh(fr: GeoFrame, layers: Layers, mapped: Building[], seed = 11) {
  const rand = rng(seed)
  const streets = layers.roads.features.filter((f) => ['residential', 'unclassified', 'tertiary'].includes(String(f.properties.cls)) && !f.properties.bridge)
  const totalLen = streets.reduce((s, f) => {
    const [[a, b], [c, d]] = lineLonLat(f)
    return s + Math.hypot(fr.x(a) - fr.x(c), fr.z(b) - fr.z(d))
  }, 0)
  const target = Math.min(Math.round(layers.totals.population / 5), 22000)
  const spacing = Math.max(11, (2 * totalLen) / Math.max(target, 1))
  const floorH = 3.1 * fr.vex

  type Inst = { m: THREE.Matrix4; c: THREE.Color }
  const gable: Inst[] = []
  const gableRoofs: Inst[] = []
  const flats: Inst[][] = [[], [], []]
  const slabs: Inst[] = []
  const tanks: Inst[] = []
  const up = new THREE.Vector3(0, 1, 0)
  const white = new THREE.Color('#ffffff')

  for (const f of streets) {
    const [[lon0, lat0], [lon1, lat1]] = lineLonLat(f)
    const ax = fr.x(lon0), az = fr.z(lat0), bx = fr.x(lon1), bz = fr.z(lat1)
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 6) continue
    const ux = (bx - ax) / len, uz = (bz - az) / len
    const angle = -Math.atan2(uz, ux)
    for (let s = spacing * rand(); s < len - 3; s += spacing * (0.75 + 0.5 * rand())) {
      for (const sideSign of [1, -1]) {
        if (rand() < 0.12) continue
        const assamType = rand() < 0.55
        const w = assamType ? 7 + rand() * 5 : 8 + rand() * 6
        const d = assamType ? 6 + rand() * 3 : 8 + rand() * 6
        const off = 5 + d / 2 + rand() * 3
        const px = ax + ux * s - uz * off * sideSign
        const pz = az + uz * s + ux * off * sideSign
        const ground = fr.y(fr.groundAtXZ(px, pz)) + (assamType ? 0.45 : 0.2) // raised plinth
        const q = new THREE.Quaternion().setFromAxisAngle(up, angle + (rand() - 0.5) * 0.08)
        const wall = new THREE.Color(PLASTER[Math.floor(rand() * PLASTER.length)])
        if (assamType) {
          const h = floorH * (0.85 + rand() * 0.15)
          const m = new THREE.Matrix4().compose(new THREE.Vector3(px, ground, pz), q, new THREE.Vector3(w, h, d))
          gable.push({ m, c: wall })
          gableRoofs.push({ m, c: new THREE.Color(TIN[Math.floor(rand() * TIN.length)]) })
        } else {
          const floors = rand() < 0.5 ? 1 : rand() < 0.75 ? 2 : 3
          const h = floors * floorH
          flats[floors - 1].push({ m: new THREE.Matrix4().compose(new THREE.Vector3(px, ground, pz), q, new THREE.Vector3(w, h, d)), c: wall })
          slabs.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(px, ground + h, pz), q, new THREE.Vector3(w + 0.5, 0.9 * fr.vex, d + 0.5)), c: white })
          if (rand() < 0.7) {
            const tp = new THREE.Vector3((rand() - 0.5) * w * 0.5, 0, (rand() - 0.5) * d * 0.5).applyQuaternion(q)
            tanks.push({
              m: new THREE.Matrix4().compose(new THREE.Vector3(px + tp.x, ground + h + 0.9 * fr.vex, pz + tp.z), q, new THREE.Vector3(1, 1.5 * fr.vex, 1)),
              c: new THREE.Color(TANK[Math.floor(rand() * TANK.length)]),
            })
          }
        }
      }
    }
  }

  const group = new THREE.Group()
  const make = (geo: THREE.BufferGeometry, mat: THREE.Material, items: Inst[]) => {
    if (!items.length) return
    const mesh = new THREE.InstancedMesh(geo, mat, items.length)
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m)
      mesh.setColorAt(i, it.c)
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  make(gableBodyGeometry(), new THREE.MeshStandardMaterial({ map: wallTexture(1, 21), roughness: 0.92 }), gable)
  make(gableRoofGeometry(), new THREE.MeshStandardMaterial({ map: roofTexture(4), roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide }), gableRoofs)
  flats.forEach((items, k) => make(box1(), new THREE.MeshStandardMaterial({ map: wallTexture(k + 1, 31 + k), roughness: 0.9 }), items))
  make(box1(), new THREE.MeshStandardMaterial({ color: '#d4cfc4', roughness: 0.95 }), slabs)
  make(new THREE.CylinderGeometry(0.6, 0.6, 1, 14).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.5 }), tanks)

  const mappedMesh = mappedBuildings(fr, mapped)
  if (mappedMesh) group.add(mappedMesh)
  const count = gable.length + flats.reduce((s, x) => s + x.length, 0)
  return { group, count, mapped: mapped.length }
}

function mappedBuildings(fr: GeoFrame, mapped: Building[]): THREE.Mesh | null {
  const geos: THREE.BufferGeometry[] = []
  for (const b of mapped) {
    const pts = b.ring.map(([lon, lat]) => new THREE.Vector2(fr.x(lon), -fr.z(lat)))
    if (pts.length < 4) continue
    const levels = b.levels ?? (b.kind === 'house' ? 1 : 2)
    const cx = b.ring.reduce((s, p) => s + p[0], 0) / b.ring.length
    const cy = b.ring.reduce((s, p) => s + p[1], 0) / b.ring.length
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: levels * 3.2 * fr.vex, bevelEnabled: false })
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, fr.y(fr.ground(cx, cy)), 0)
    geos.push(geo.toNonIndexed())
    geo.dispose()
  }
  if (!geos.length) return null
  const merged = mergeGeometries(geos)
  geos.forEach((g) => g.dispose())
  if (!merged) return null
  const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: '#ebe6dc', roughness: 0.85 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/* ----------------------------------------------------------------- trees */

function broadleafCrown(seed: number): THREE.BufferGeometry {
  const r = rng(seed)
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++) {
    const g = new THREE.IcosahedronGeometry(0.55 + r() * 0.3, 1)
    const p = g.getAttribute('position')
    for (let k = 0; k < p.count; k++) {
      const s = 0.85 + r() * 0.3
      p.setXYZ(k, p.getX(k) * s, p.getY(k) * s, p.getZ(k) * s)
    }
    g.translate((r() - 0.5) * 0.7, 0.55 + r() * 0.5, (r() - 0.5) * 0.7)
    const flat = g.toNonIndexed()
    flat.deleteAttribute('uv')
    parts.push(flat)
  }
  const m = mergeGeometries(parts)!
  m.computeVertexNormals()
  return m
}

function palmCrown(): THREE.BufferGeometry {
  const fronds: THREE.BufferGeometry[] = []
  for (let i = 0; i < 9; i++) {
    const f = new THREE.ConeGeometry(0.16, 1.9, 3, 1).translate(0, 0.95, 0)
    f.scale(1, 1, 0.25)
    f.rotateZ(-Math.PI / 2 + 0.55)
    f.rotateY((i / 9) * Math.PI * 2)
    fronds.push(f.toNonIndexed())
  }
  return mergeGeometries(fronds)!
}

/** Broadleaf trees and areca palms, kept away from streets and the river bed. */
export function treesMesh(fr: GeoFrame, layers: Layers, count: number, seed = 5) {
  const rand = rng(seed)
  const cell = 22
  const busy = new Set<string>()
  for (const f of layers.roads.features) {
    for (const [lon, lat] of lineLonLat(f)) busy.add(`${Math.floor(fr.x(lon) / cell)},${Math.floor(fr.z(lat) / cell)}`)
  }
  const half = fr.size / 2
  type T = { pos: THREE.Vector3; s: number; rot: number; c: THREE.Color }
  const broad: T[] = []
  const palms: T[] = []
  for (let tries = 0; broad.length + palms.length < count && tries < count * 10; tries++) {
    const x = (rand() * 2 - 1) * half
    const z = (rand() * 2 - 1) * half
    if (busy.has(`${Math.floor(x / cell)},${Math.floor(z / cell)}`)) continue
    const h = fr.groundAtXZ(x, z)
    if (h < 0.6) continue
    const item = { pos: new THREE.Vector3(x, fr.y(h), z), s: 0.8 + rand() * 0.6, rot: rand() * Math.PI * 2, c: new THREE.Color().setHSL(0.22 + rand() * 0.1, 0.45 + rand() * 0.2, 0.2 + rand() * 0.12) }
    ;(rand() < 0.3 ? palms : broad).push(item)
  }
  const group = new THREE.Group()
  const bark = new THREE.MeshStandardMaterial({ color: '#5b4a38', roughness: 1 })
  const leaf = new THREE.MeshStandardMaterial({ roughness: 0.85 })
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const place = (geo: THREE.BufferGeometry, mat: THREE.Material, items: T[], scale: (t: T) => THREE.Vector3, lift: (t: T) => number, colour: boolean) => {
    if (!items.length) return
    const mesh = new THREE.InstancedMesh(geo, mat, items.length)
    items.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot)
      mesh.setMatrixAt(i, new THREE.Matrix4().compose(t.pos.clone().setY(t.pos.y + lift(t)), q, scale(t)))
      if (colour) mesh.setColorAt(i, t.c)
    })
    mesh.castShadow = true
    group.add(mesh)
  }
  const v = fr.vex
  place(new THREE.CylinderGeometry(0.18, 0.3, 1, 6).translate(0, 0.5, 0), bark, broad, (t) => new THREE.Vector3(t.s, 4 * t.s * v, t.s), () => 0, false)
  place(broadleafCrown(seed), leaf, broad, (t) => new THREE.Vector3(5 * t.s, 4.5 * t.s * v, 5 * t.s), (t) => 3.2 * t.s * v, true)
  place(new THREE.CylinderGeometry(0.1, 0.14, 1, 6).translate(0, 0.5, 0), bark, palms, (t) => new THREE.Vector3(t.s, 12 * t.s * v, t.s), () => 0, false)
  place(palmCrown(), leaf, palms, (t) => new THREE.Vector3(2.4 * t.s, 2.4 * t.s * v, 2.4 * t.s), (t) => 12 * t.s * v, true)
  return group
}

/* ----------------------------------------------------- boats and people */

function clean(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g
  for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal') out.deleteAttribute(name)
  return out
}

/** Rescue boat: pointed hull and a small canopy on poles. About 7 m long, bow along +x. */
export function boatGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-3.5, -1.2)
  s.lineTo(2.2, -1.2)
  s.quadraticCurveTo(3.6, -0.6, 3.6, 0)
  s.quadraticCurveTo(3.6, 0.6, 2.2, 1.2)
  s.lineTo(-3.5, 1.2)
  s.lineTo(-3.5, -1.2)
  const hull = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.1, bevelSegments: 2 })
  hull.rotateX(-Math.PI / 2)
  const canopy = new THREE.BoxGeometry(2, 0.12, 2).translate(-1.4, 2.2, 0)
  const pole1 = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 4).translate(-0.5, 1.6, 0.9)
  const pole2 = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 4).translate(-2.3, 1.6, -0.9)
  return mergeGeometries([hull, canopy, pole1, pole2].map(clean))!
}

export function personGeometry(): THREE.BufferGeometry {
  return mergeGeometries([new THREE.CapsuleGeometry(0.25, 0.9, 3, 6).translate(0, 0.75, 0), new THREE.SphereGeometry(0.17, 8, 6).translate(0, 1.55, 0)].map(clean))!
}

/* ----------------------------------------------------------------- water */

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
