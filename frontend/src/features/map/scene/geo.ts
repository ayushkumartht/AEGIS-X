import * as THREE from 'three'
import type { GeoFeature, TerrainGrid } from '@/api/types'

/** Local metric frame: x east, z south (three.js), y up; heights exaggerated by `vex`. */
export class GeoFrame {
  readonly t: TerrainGrid
  readonly cx: number
  readonly cy: number
  readonly kx: number
  readonly ky: number
  readonly vex: number
  readonly size: number // metres across the larger side

  constructor(t: TerrainGrid, vex: number) {
    this.t = t
    const [lon0, lat0, lon1, lat1] = t.bounds
    this.cx = (lon0 + lon1) / 2
    this.cy = (lat0 + lat1) / 2
    this.kx = 111_320 * Math.cos((this.cy * Math.PI) / 180)
    this.ky = 110_540
    this.vex = vex
    this.size = Math.max((lon1 - lon0) * this.kx, (lat1 - lat0) * this.ky)
  }

  x(lon: number) {
    return (lon - this.cx) * this.kx
  }
  z(lat: number) {
    return -(lat - this.cy) * this.ky
  }
  lon(x: number) {
    return x / this.kx + this.cx
  }
  lat(z: number) {
    return -z / this.ky + this.cy
  }
  /** Scene height of a ground height in metres above the river's normal level. */
  y(h: number) {
    return h * this.vex
  }
  /** Terrain height (metres above normal) at a lon/lat, bilinear from the grid. */
  ground(lon: number, lat: number): number {
    const { n, bounds, heights } = this.t
    const fx = ((lon - bounds[0]) / (bounds[2] - bounds[0])) * (n - 1)
    const fy = ((lat - bounds[1]) / (bounds[3] - bounds[1])) * (n - 1)
    const c = Math.min(Math.max(Math.floor(fx), 0), n - 2)
    const r = Math.min(Math.max(Math.floor(fy), 0), n - 2)
    const dx = Math.min(Math.max(fx - c, 0), 1)
    const dy = Math.min(Math.max(fy - r, 0), 1)
    const h = (rr: number, cc: number) => heights[rr * n + cc]
    return (h(r, c) * (1 - dx) + h(r, c + 1) * dx) * (1 - dy) + (h(r + 1, c) * (1 - dx) + h(r + 1, c + 1) * dx) * dy
  }
  groundAtXZ(x: number, z: number) {
    return this.ground(this.lon(x), this.lat(z))
  }
  point(lon: number, lat: number, lift = 0) {
    return new THREE.Vector3(this.x(lon), this.y(this.ground(lon, lat)) + lift, this.z(lat))
  }
}

export const lonLat = (f: GeoFeature) => f.geometry.coordinates as number[]
export const lineLonLat = (f: GeoFeature) => f.geometry.coordinates as number[][]

/** Small deterministic random generator, so generated scenery is the same on every load. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Web Mercator tile maths for draping satellite imagery
export const tileX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z
export const tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}
