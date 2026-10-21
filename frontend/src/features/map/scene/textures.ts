import * as THREE from 'three'
import { rng } from './geo'

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  return { c, ctx }
}

function finish(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/**
 * Plastered wall with `floors` rows of windows, a door on the ground floor, a darker plinth and
 * weathering streaks. White base so per-house instance colours tint the plaster.
 */
export function wallTexture(floors: number, seed: number): THREE.Texture {
  const W = 256
  const H = 96 * floors + 24
  const { c, ctx } = canvas(W, H)
  const r = rng(seed)
  ctx.fillStyle = '#f2f0ec'
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(90,80,60,${0.02 + r() * 0.05})`
    ctx.fillRect(r() * W, r() * H, 2 + r() * 10, 2 + r() * 18)
  }
  for (let x = 0; x < W; x += 6 + r() * 30) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(70,60,45,0.12)')
    g.addColorStop(1, 'rgba(70,60,45,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, 2 + r() * 3, H * (0.2 + r() * 0.5))
  }
  ctx.fillStyle = '#8f8a80'
  ctx.fillRect(0, H - 24, W, 24)
  for (let f = 0; f < floors; f++) {
    const top = f * 96 + 22
    if (f > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(0, f * 96 + 2, W, 5)
    }
    const windows = 3
    for (let k = 0; k < windows; k++) {
      const x = 22 + k * 78
      const isDoor = f === floors - 1 && k === 1
      const wy = isDoor ? top + 6 : top + 6
      const wh = isDoor ? 96 - 6 : 44
      ctx.fillStyle = '#5b4a3a'
      ctx.fillRect(x - 4, wy - 4, 46, wh + 8)
      ctx.fillStyle = isDoor ? '#6b4a2e' : '#2c3a46'
      ctx.fillRect(x, wy, 38, wh)
      if (!isDoor) {
        ctx.fillStyle = 'rgba(180,210,230,0.35)'
        ctx.fillRect(x + 3, wy + 3, 14, wh - 6)
        ctx.strokeStyle = '#3d3a35'
        ctx.lineWidth = 2
        for (let b = x + 7; b < x + 38; b += 7) {
          ctx.beginPath()
          ctx.moveTo(b, wy)
          ctx.lineTo(b, wy + wh)
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.fillRect(x - 6, wy - 9, 50, 5)
      }
    }
  }
  return finish(c)
}

/** Corrugated tin roof with rust patches. White base so instance colours tint it. */
export function roofTexture(seed: number): THREE.Texture {
  const { c, ctx } = canvas(256, 256)
  const r = rng(seed)
  for (let x = 0; x < 256; x++) {
    const v = 200 + 40 * Math.sin((x / 256) * Math.PI * 2 * 24)
    ctx.fillStyle = `rgb(${v},${v},${v})`
    ctx.fillRect(x, 0, 1, 256)
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(140,70,30,${0.05 + r() * 0.15})`
    ctx.beginPath()
    ctx.ellipse(r() * 256, r() * 256, 6 + r() * 30, 4 + r() * 14, r() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  return finish(c, true)
}

/** Fine grass and soil detail for the ground when no satellite imagery is shown. */
export function groundTexture(): THREE.Texture {
  const { c, ctx } = canvas(512, 512)
  const r = rng(3)
  ctx.fillStyle = '#7d8a4e'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 9000; i++) {
    const g = 90 + r() * 70
    ctx.fillStyle = `rgba(${g * 0.75},${g},${g * 0.45},${0.25 + r() * 0.4})`
    ctx.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3)
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(120,95,60,${0.08 + r() * 0.15})`
    ctx.beginPath()
    ctx.ellipse(r() * 512, r() * 512, 10 + r() * 50, 6 + r() * 30, r() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  return finish(c, true)
}

/** Asphalt with a dashed white centre line along u. */
export function roadTexture(): THREE.Texture {
  const { c, ctx } = canvas(64, 256)
  const r = rng(9)
  ctx.fillStyle = '#3b3c3f'
  ctx.fillRect(0, 0, 64, 256)
  for (let i = 0; i < 600; i++) {
    const v = 50 + r() * 40
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`
    ctx.fillRect(r() * 64, r() * 256, 1, 1)
  }
  ctx.fillStyle = 'rgba(230,230,220,0.85)'
  for (let y = 0; y < 256; y += 64) ctx.fillRect(30, y, 4, 32)
  ctx.fillStyle = 'rgba(210,205,190,0.6)'
  ctx.fillRect(2, 0, 2, 256)
  ctx.fillRect(60, 0, 2, 256)
  return finish(c, true)
}
