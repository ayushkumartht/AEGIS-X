import * as THREE from 'three'
import { tileX, tileY } from './geo'

const URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile'
export const IMAGERY_CREDIT = 'Imagery © Esri, Maxar, Earthstar Geographics'

export interface Satellite {
  texture: THREE.Texture
  z: number
  x0: number
  y0: number
  nx: number
  ny: number
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** Stitch satellite tiles covering `bounds` into one texture. Resolves null when offline. */
export async function loadSatellite(bounds: [number, number, number, number], maxTiles = 110): Promise<Satellite | null> {
  const [lon0, lat0, lon1, lat1] = bounds
  let z = 18
  let x0 = 0, x1 = 0, y0 = 0, y1 = 0
  for (; z >= 10; z--) {
    x0 = Math.floor(tileX(lon0, z))
    x1 = Math.floor(tileX(lon1, z))
    y0 = Math.floor(tileY(lat1, z))
    y1 = Math.floor(tileY(lat0, z))
    if ((x1 - x0 + 1) * (y1 - y0 + 1) <= maxTiles) break
  }
  const nx = x1 - x0 + 1
  const ny = y1 - y0 + 1
  const canvas = document.createElement('canvas')
  canvas.width = nx * 256
  canvas.height = ny * 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const jobs: Promise<boolean>[] = []
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      jobs.push(
        loadImage(`${URL}/${z}/${ty}/${tx}`).then((img) => {
          if (img) ctx.drawImage(img, (tx - x0) * 256, (ty - y0) * 256)
          return !!img
        }),
      )
    }
  }
  const ok = await Promise.all(jobs)
  if (!ok.some(Boolean)) return null
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return { texture, z, x0, y0, nx, ny }
}
