import * as THREE from 'three'
import type { GeoFeature } from '@/api/types'
import { boatGeometry } from './builders'
import { GeoFrame, lonLat, rng } from './geo'
import { crossTexture, hallGeometry, jettyGeometry, pinGeometry, tentGeometry } from './models'

const UP = new THREE.Vector3(0, 1, 0)

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, n: number) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(n, 1))
  m.castShadow = true
  m.receiveShadow = true
  m.frustumCulled = false
  return m
}

/* ------------------------------------------------------------ settlement pins */

export interface Pins {
  mesh: THREE.InstancedMesh
  height: (people: number) => number
  place: (k: number, people: number, color: THREE.Color, t: number) => void
}

/** Floating glossy map pins over settlements; their size follows the people still in the area. */
export function createPins(positions: THREE.Vector3[], populations: number[], size: number): Pins {
  const maxPop = Math.max(...populations, 1)
  const mesh = instanced(pinGeometry(), new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1 }), positions.length)
  mesh.castShadow = false
  const height = (people: number) => Math.max(12, (size / 150) * (0.5 + 0.9 * Math.sqrt(Math.max(people, 0) / maxPop)))
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const place = (k: number, people: number, color: THREE.Color, t: number) => {
    const h = height(people) / 2
    const lift = 6 + Math.sin(t * 2 + k * 0.7) * 1.4
    q.setFromAxisAngle(UP, t * 0.6 + k)
    m.compose(new THREE.Vector3(positions[k].x, positions[k].y + lift, positions[k].z), q, new THREE.Vector3(h, h, h))
    mesh.setMatrixAt(k, m)
    mesh.setColorAt(k, color)
  }
  return { mesh, height, place }
}

/* -------------------------------------------------------------- relief camps */

export interface Camps {
  group: THREE.Group
  pickables: THREE.Object3D[]
  shelterOf: (obj: THREE.Object3D, instanceId: number) => number | null
  setFlooded: (flooded: boolean[]) => void
  update: (t: number) => void
  topOf: (k: number) => THREE.Vector3
}

/**
 * A relief camp per shelter: ground pad, plastered hall with a green-cross sign, a fan of tents
 * and a fluttering flag. Assumed assembly points get tents and a flag but no hall.
 */
export function createCamps(fr: GeoFrame, features: GeoFeature[], size: number): Camps {
  const n = features.length
  const rand = rng(404)
  const pos = features.map((f) => {
    const [lon, lat] = lonLat(f)
    return fr.point(lon, lat)
  })
  const cap = features.map((f) => Number(f.properties.capacity))
  const maxCap = Math.max(...cap, 1)
  const assumed = features.map((f) => String(f.properties.kind).startsWith('assumed'))
  const unit = Math.max(1, size / 6000)
  const dims = features.map((_, k) => ({ w: (14 + 16 * Math.sqrt(cap[k] / maxCap)) * unit, d: (9 + 6 * Math.sqrt(cap[k] / maxCap)) * unit, h: 5.6 * unit, yaw: rand() * Math.PI * 2 }))

  const group = new THREE.Group()
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()

  const pads = instanced(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#a39c8c', roughness: 1 }), n)
  pads.castShadow = false
  const halls = instanced(hallGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), n)
  const crosses = instanced(new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ map: crossTexture() }), n)
  crosses.castShadow = false
  const TENTS = 6
  const tents = instanced(tentGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), n * TENTS)
  const poles = instanced(new THREE.CylinderGeometry(0.09, 0.12, 12, 8).translate(0, 6, 0), new THREE.MeshStandardMaterial({ color: '#e5e7eb', metalness: 0.6, roughness: 0.35 }), n)
  const flags = instanced(new THREE.PlaneGeometry(4.4, 2.6).translate(2.2, 0, 0), new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide, emissive: '#14532d', emissiveIntensity: 0.25 }), n)
  const tentColors = ['#f97316', '#f8fafc', '#16a34a', '#2563eb', '#fbbf24', '#f8fafc']
  const hide = new THREE.Matrix4().makeScale(0, 0, 0)

  features.forEach((_, k) => {
    const p = pos[k]
    const { w, d, h, yaw } = dims[k]
    q.setFromAxisAngle(UP, yaw)
    m.compose(new THREE.Vector3(p.x, p.y + 0.15, p.z), q, new THREE.Vector3(30 * unit, 1, 30 * unit))
    pads.setMatrixAt(k, m)
    if (assumed[k]) {
      halls.setMatrixAt(k, hide)
      crosses.setMatrixAt(k, hide)
    } else {
      m.compose(new THREE.Vector3(p.x, p.y + 0.15, p.z), q, new THREE.Vector3(w, h, d))
      halls.setMatrixAt(k, m)
      halls.setColorAt(k, new THREE.Color('#ffffff'))
      const front = new THREE.Vector3(w / 2 + 0.08, h * 0.62, 0).applyQuaternion(q)
      m.compose(new THREE.Vector3(p.x + front.x, p.y + 0.15 + front.y, p.z + front.z), q, new THREE.Vector3(1, 3.4 * unit, 3.4 * unit))
      crosses.setMatrixAt(k, m)
      crosses.setColorAt(k, new THREE.Color('#ffffff'))
    }
    for (let i = 0; i < TENTS; i++) {
      const a = yaw + Math.PI / 2 + ((i - (TENTS - 1) / 2) * Math.PI) / 7
      const r = (assumed[k] ? 9 : w / 2 + 11) * unit
      const tp = new THREE.Vector3(Math.cos(a) * r, 0, -Math.sin(a) * r)
      q.setFromAxisAngle(UP, a)
      m.compose(new THREE.Vector3(p.x + tp.x, p.y + 0.15, p.z + tp.z), q, new THREE.Vector3(4.6 * unit, 2.8 * unit, 4.6 * unit))
      tents.setMatrixAt(k * TENTS + i, m)
      tents.setColorAt(k * TENTS + i, new THREE.Color(tentColors[i % tentColors.length]))
    }
    m.compose(new THREE.Vector3(p.x - 6 * unit, p.y + 0.15, p.z + 6 * unit), new THREE.Quaternion(), new THREE.Vector3(unit, unit, unit))
    poles.setMatrixAt(k, m)
    flags.setColorAt(k, new THREE.Color('#16a34a'))
  })
  group.add(pads, halls, crosses, tents, poles, flags)

  const flagAt = new THREE.Vector3()
  const update = (t: number) => {
    features.forEach((_, k) => {
      const p = pos[k]
      flagAt.set(p.x - 6 * unit, p.y + 0.15 + 10.4 * unit, p.z + 6 * unit)
      q.setFromAxisAngle(UP, Math.sin(t * 3 + k) * 0.35)
      m.compose(flagAt, q, new THREE.Vector3(unit * (0.92 + 0.08 * Math.sin(t * 6 + k)), unit, unit))
      flags.setMatrixAt(k, m)
    })
    flags.instanceMatrix.needsUpdate = true
  }
  update(0)

  const setFlooded = (flooded: boolean[]) => {
    flooded.forEach((f, k) => {
      flags.setColorAt(k, new THREE.Color(f ? '#6b7280' : '#16a34a'))
      if (!assumed[k]) crosses.setColorAt(k, new THREE.Color(f ? '#9ca3af' : '#ffffff'))
    })
    if (flags.instanceColor) flags.instanceColor.needsUpdate = true
    if (crosses.instanceColor) crosses.instanceColor.needsUpdate = true
  }

  return {
    group,
    pickables: [halls, crosses, tents, poles, flags, pads],
    shelterOf: (obj, id) => (obj === tents ? Math.floor(id / TENTS) : obj === halls || obj === crosses || obj === poles || obj === flags || obj === pads ? id : null),
    setFlooded,
    update,
    topOf: (k) => new THREE.Vector3(pos[k].x, pos[k].y + (assumed[k] ? 12 : dims[k].h + 4) * unit + 6, pos[k].z),
  }
}

/* --------------------------------------------------------------- boat bases */

export interface Bases {
  group: THREE.Group
  positions: Map<string, THREE.Vector3>
}

/** A jetty with docked rescue boats, a boat shed and a flag, turned towards the lower ground (the river). */
export function createBases(fr: GeoFrame, features: GeoFeature[], size: number): Bases {
  const group = new THREE.Group()
  const positions = new Map<string, THREE.Vector3>()
  const unit = Math.max(1, size / 5000)
  const jetty = jettyGeometry()
  const boat = boatGeometry()
  const wood = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })
  const hull = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.45 })
  const shedWall = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
  const pole = new THREE.MeshStandardMaterial({ color: '#e5e7eb', metalness: 0.6, roughness: 0.35 })
  const flagMat = new THREE.MeshStandardMaterial({ color: '#7c3aed', emissive: '#5b21b6', emissiveIntensity: 0.3, side: THREE.DoubleSide })
  for (const f of features) {
    const [lon, lat] = lonLat(f)
    const p = fr.point(lon, lat)
    positions.set(String(f.properties.id), p)
    let best = 0
    let bestH = Infinity
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const h = fr.groundAtXZ(p.x + Math.cos(a) * 70, p.z + Math.sin(a) * 70)
      if (h < bestH) {
        bestH = h
        best = a
      }
    }
    const g = new THREE.Group()
    g.position.copy(p)
    g.rotation.y = -best
    g.scale.setScalar(unit)
    const j = new THREE.Mesh(jetty, wood)
    j.position.set(14, 0.2, 0)
    g.add(j)
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(boat, hull)
      b.position.set(8 + i * 8, 0.4, 4.2 * (i % 2 === 0 ? 1 : -1))
      b.rotation.y = i % 2 === 0 ? 0.08 : -0.08
      b.scale.setScalar(1.15)
      g.add(b)
    }
    const shed = new THREE.Mesh(hallGeometry(), shedWall)
    shed.position.set(-8, 0, -6)
    shed.scale.set(12, 4.2, 7)
    g.add(shed)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 13, 8).translate(0, 6.5, 0), pole)
    mast.position.set(-2, 0, 5)
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.8).translate(2.3, 0, 0), flagMat)
    flag.position.set(-2, 12, 5)
    g.add(mast, flag)
    g.traverse((o) => {
      o.castShadow = true
      o.receiveShadow = true
      o.userData = { kind: 'staging', id: String(f.properties.id), name: String(f.properties.name) }
    })
    group.add(g)
  }
  return { group, positions }
}
