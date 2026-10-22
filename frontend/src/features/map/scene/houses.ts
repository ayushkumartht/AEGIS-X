import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Building, Layers } from '@/api/types'
import { box1, gableBodyGeometry, gableRoofGeometry, mappedBuildings } from './builders'
import { GeoFrame, lineLonLat, rng } from './geo'
import { shopWallTexture } from './models'
import { roofTexture, wallTexture } from './textures'

const PLASTER = ['#f3eee4', '#efe3cc', '#e3ecef', '#f4dccb', '#ece6bf', '#e2dcd2', '#f6f4ef', '#dde6d3', '#f1d6d6', '#d9e4f2', '#f7e4b8', '#cfe3d4']
const TIN = ['#8d949c', '#9a5a41', '#4f7398', '#6f8060', '#a9adb2', '#b0603e', '#3f6e7a']
const TILE = ['#a8412c', '#9b3a28', '#b4532f', '#7c3d2d']
const TANK = ['#1f2326', '#2b3a55', '#1f2326', '#3a3a3a']
const SIGNS = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2']
const GARDEN = ['#86a05c', '#9bb06a', '#b7a77c', '#8fa163', '#a3b374']

interface Inst {
  m: THREE.Matrix4
  c: THREE.Color
}

/** Square ring of height 1 whose wall thickness is `th` of the footprint: compound walls and parapets. */
function frameGeometry(th: number): THREE.BufferGeometry {
  const parts = [
    new THREE.BoxGeometry(1, 1, th).translate(0, 0.5, 0.5 - th / 2),
    new THREE.BoxGeometry(1, 1, th).translate(0, 0.5, -0.5 + th / 2),
    new THREE.BoxGeometry(th, 1, 1 - 2 * th).translate(0.5 - th / 2, 0.5, 0),
    new THREE.BoxGeometry(th, 1, 1 - 2 * th).translate(-0.5 + th / 2, 0.5, 0),
  ].map((g) => {
    g.deleteAttribute('uv')
    return g.toNonIndexed()
  })
  const g = mergeGeometries(parts)!
  g.computeVertexNormals()
  return g
}

/** Four-sided pyramid roof over a unit footprint (hipped roof), base on y = 0. */
function hippedRoofGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0, 0.78, 1, 4, 1, true).rotateY(Math.PI / 4).translate(0, 0.5, 0)
  g.deleteAttribute('uv')
  return g.toNonIndexed()
}

/**
 * Illustrative houses along the streets, about one per four to five people: Assam-type tin-roof houses on
 * a plinth with a veranda, RCC houses with flat roofs, parapets, tanks and AC units, shop-houses on
 * the main streets with shutters and signboards, and bungalows with tiled hipped roofs. Plots and
 * compound walls give each house a footprint. Placement is generated, not surveyed.
 */
export function housesMesh(fr: GeoFrame, layers: Layers, mapped: Building[], seed = 11) {
  const rand = rng(seed)
  const lines = layers.roads.features.filter((f) => ['residential', 'unclassified', 'tertiary', 'secondary'].includes(String(f.properties.cls)) && !f.properties.bridge)
  const lenOf = (f: (typeof lines)[number]) => {
    const [[a, b], [c, d]] = lineLonLat(f)
    return Math.hypot(fr.x(a) - fr.x(c), fr.z(b) - fr.z(d))
  }
  const totalLen = lines.reduce((s, f) => s + lenOf(f), 0)
  const target = Math.min(Math.round(layers.totals.population / 4.5), 15000)
  const spacing = Math.max(10, (2 * totalLen) / Math.max(target, 1))
  const floorH = 3.1 * fr.vex

  const assam: Inst[] = []
  const assamRoof: Inst[] = []
  const veranda: Inst[] = []
  const posts: Inst[] = []
  const rcc: Inst[][] = [[], [], []]
  const shops: Inst[][] = [[], [], []]
  const bung: Inst[] = []
  const bungRoof: Inst[] = []
  const slabs: Inst[] = []
  const parapets: Inst[] = []
  const walls: Inst[] = []
  const plots: Inst[] = []
  const tanks: Inst[] = []
  const acs: Inst[] = []
  const signs: Inst[] = []
  const white = new THREE.Color('#ffffff')
  const up = new THREE.Vector3(0, 1, 0)

  for (const f of lines) {
    const cls = String(f.properties.cls)
    const [[lon0, lat0], [lon1, lat1]] = lineLonLat(f)
    const ax = fr.x(lon0), az = fr.z(lat0), bx = fr.x(lon1), bz = fr.z(lat1)
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 8) continue
    const ux = (bx - ax) / len, uz = (bz - az) / len
    const base = -Math.atan2(uz, ux)
    const main = cls === 'tertiary' || cls === 'secondary'
    const halfRoad = cls === 'secondary' ? 5 : cls === 'tertiary' ? 4 : 3
    for (let s = spacing * rand(); s < len - 4; s += spacing * (0.8 + 0.5 * rand())) {
      for (const side of [1, -1]) {
        if (rand() < 0.1) continue
        const roll = rand()
        const type = main && roll < 0.55 ? 'shop' : roll < 0.45 ? 'assam' : roll < 0.85 ? 'rcc' : 'bung'
        const w = type === 'shop' ? 6.5 + rand() * 3 : type === 'assam' ? 9 + rand() * 4 : type === 'bung' ? 13 + rand() * 5 : 10 + rand() * 6
        const d = type === 'shop' ? 12 + rand() * 4 : type === 'assam' ? 7 + rand() * 2.5 : type === 'bung' ? 11 + rand() * 4 : 9 + rand() * 5
        const setback = type === 'shop' ? 1.5 : 4 + rand() * 4
        const off = halfRoad + setback + d / 2
        const cx = ax + ux * s - uz * off * side
        const cz = az + uz * s + ux * off * side
        const ground = fr.y(fr.groundAtXZ(cx, cz))
        const q = new THREE.Quaternion().setFromAxisAngle(up, base + (side === 1 ? Math.PI : 0) + (rand() - 0.5) * 0.06)
        const at = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, gy = ground) => {
          const v = new THREE.Vector3(lx, 0, lz).applyQuaternion(q)
          return new THREE.Matrix4().compose(new THREE.Vector3(cx + v.x, gy + ly, cz + v.z), q, new THREE.Vector3(sx, sy, sz))
        }
        const wall = new THREE.Color(PLASTER[Math.floor(rand() * PLASTER.length)])
        const plot = new THREE.Color(GARDEN[Math.floor(rand() * GARDEN.length)])
        if (type !== 'shop') {
          const pw = w + 7
          const pd = d + 7
          plots.push({ m: at(0, 0.06, 0, pw, 1, pd), c: plot })
          if (rand() < 0.8) walls.push({ m: at(0, 0, 0, pw, 0.95, pd), c: new THREE.Color('#d8d2c4') })
        }
        if (type === 'assam') {
          const gy = ground + 0.45
          const h = floorH * (0.88 + rand() * 0.14)
          assam.push({ m: at(0, 0, 0, w, h, d, gy), c: wall })
          assamRoof.push({ m: at(0, 0, 0, w, h, d, gy), c: new THREE.Color(TIN[Math.floor(rand() * TIN.length)]) })
          veranda.push({ m: at(0, h * 0.8, d / 2 + 1.35, w * 0.96, 0.22, 2.7, gy), c: new THREE.Color(TIN[Math.floor(rand() * TIN.length)]) })
          for (const px of [-0.4, 0, 0.4]) posts.push({ m: at(px * w, 0, d / 2 + 2.5, 0.2, h * 0.8, 0.2, gy), c: new THREE.Color('#8b6b4a') })
        } else if (type === 'rcc') {
          const floors = rand() < 0.45 ? 1 : rand() < 0.75 ? 2 : 3
          const h = floors * floorH
          rcc[floors - 1].push({ m: at(0, 0, 0, w, h, d, ground + 0.2), c: wall })
          slabs.push({ m: at(0, h, 0, w + 0.5, 0.45, d + 0.5, ground + 0.2), c: white })
          parapets.push({ m: at(0, h + 0.45, 0, w + 0.5, 0.9, d + 0.5, ground + 0.2), c: new THREE.Color('#e6e1d6') })
          if (rand() < 0.75) tanks.push({ m: at((rand() - 0.5) * w * 0.4, h + 0.45, (rand() - 0.5) * d * 0.4, 1, 1.5, 1, ground + 0.2), c: new THREE.Color(TANK[Math.floor(rand() * TANK.length)]) })
          if (floors > 1 && rand() < 0.7) acs.push({ m: at(w * 0.28, h - floorH * 0.55, d / 2 + 0.45, 1.1, 0.6, 0.55, ground + 0.2), c: white })
        } else if (type === 'shop') {
          const floors = rand() < 0.5 ? 2 : rand() < 0.7 ? 3 : 4
          const h = floors * floorH
          shops[floors - 2].push({ m: at(0, 0, 0, w, h, d, ground + 0.15), c: new THREE.Color(PLASTER[Math.floor(rand() * PLASTER.length)]) })
          slabs.push({ m: at(0, h, 0, w + 0.4, 0.4, d + 0.4, ground + 0.15), c: white })
          signs.push({ m: at(0, floorH * 1.05, d / 2 + 0.15, w * 0.92, 1.2, 0.22, ground + 0.15), c: new THREE.Color(SIGNS[Math.floor(rand() * SIGNS.length)]) })
          if (rand() < 0.6) tanks.push({ m: at((rand() - 0.5) * w * 0.4, h + 0.4, 0, 1, 1.5, 1, ground + 0.15), c: new THREE.Color(TANK[Math.floor(rand() * TANK.length)]) })
        } else {
          const h = floorH * (rand() < 0.6 ? 1 : 2)
          bung.push({ m: at(0, 0, 0, w, h, d, ground + 0.3), c: wall })
          bungRoof.push({ m: at(0, h, 0, w, 2.4, d, ground + 0.3), c: new THREE.Color(TILE[Math.floor(rand() * TILE.length)]) })
          if (rand() < 0.5) acs.push({ m: at(-w * 0.3, h * 0.55, d / 2 + 0.45, 1.1, 0.6, 0.55, ground + 0.3), c: white })
        }
      }
    }
  }

  const group = new THREE.Group()
  const make = (geo: THREE.BufferGeometry, mat: THREE.Material, items: Inst[], shadow = true) => {
    if (!items.length) return
    const mesh = new THREE.InstancedMesh(geo, mat, items.length)
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m)
      mesh.setColorAt(i, it.c)
    })
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    group.add(mesh)
  }
  const wallMat = (floors: number, seed2: number) => new THREE.MeshStandardMaterial({ map: wallTexture(floors, seed2), roughness: 0.92 })
  make(gableBodyGeometry(), wallMat(1, 21), assam)
  make(gableRoofGeometry(), new THREE.MeshStandardMaterial({ map: roofTexture(4), roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide }), assamRoof)
  make(box1(), new THREE.MeshStandardMaterial({ map: roofTexture(7), roughness: 0.5, metalness: 0.5 }), veranda)
  make(box1(), new THREE.MeshStandardMaterial({ roughness: 0.9 }), posts, false)
  rcc.forEach((items, k) => make(box1(), wallMat(k + 1, 31 + k), items))
  shops.forEach((items, k) => make(box1(), new THREE.MeshStandardMaterial({ map: shopWallTexture(k + 2, 51 + k), roughness: 0.88 }), items))
  make(box1(), wallMat(1, 41), bung)
  make(hippedRoofGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide }), bungRoof)
  make(box1(), new THREE.MeshStandardMaterial({ color: '#d4cfc4', roughness: 0.95 }), slabs)
  make(frameGeometry(0.035), new THREE.MeshStandardMaterial({ color: '#e6e1d6', roughness: 0.95 }), parapets, false)
  make(frameGeometry(0.03), new THREE.MeshStandardMaterial({ roughness: 0.95 }), walls, false)
  make(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), plots, false)
  make(new THREE.CylinderGeometry(0.6, 0.6, 1, 14).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.5 }), tanks)
  make(box1(), new THREE.MeshStandardMaterial({ roughness: 0.6 }), acs, false)
  make(box1(), new THREE.MeshStandardMaterial({ roughness: 0.6, emissiveIntensity: 0.2 }), signs, false)

  const mappedMesh = mappedBuildings(fr, mapped)
  if (mappedMesh) group.add(mappedMesh)
  const count = assam.length + rcc.reduce((s, x) => s + x.length, 0) + shops.reduce((s, x) => s + x.length, 0) + bung.length
  return { group, count, mapped: mapped.length }
}
