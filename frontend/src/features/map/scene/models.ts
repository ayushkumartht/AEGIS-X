import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Drop every attribute except position, normal and colour, and make the geometry non-indexed. */
export function clean(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g
  for (const name of Object.keys(out.attributes)) if (!['position', 'normal', 'color'].includes(name)) out.deleteAttribute(name)
  if (!out.getAttribute('normal')) out.computeVertexNormals()
  if (!out.getAttribute('color')) {
    const n = out.getAttribute('position').count
    out.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3))
  }
  return out
}

/** Box sitting on y = 0 (centre of its base at x, z), with a vertex colour. */
function part(w: number, h: number, d: number, x: number, y: number, z: number, color: string): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z)
  return paint(g, color)
}

export function paint(g: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const c = new THREE.Color(color)
  const n = g.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

const merge = (parts: THREE.BufferGeometry[]) => {
  const m = mergeGeometries(parts.map(clean))!
  m.computeVertexNormals()
  return m
}

/** Wheels are dark, glass is blue-grey, the body is white so the instance colour tints it. Forward is +x. */
export function carGeometry(): THREE.BufferGeometry {
  const wheel = (x: number, z: number) => paint(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10).rotateX(Math.PI / 2).translate(x, 0.34, z), '#1b1b1d')
  return merge([
    part(4.1, 0.75, 1.8, 0, 0.32, 0, '#ffffff'),
    part(2.2, 0.62, 1.6, -0.25, 1.07, 0, '#ffffff'),
    part(2.0, 0.4, 1.64, -0.25, 1.14, 0, '#5a7488'),
    wheel(1.3, 0.88), wheel(1.3, -0.88), wheel(-1.3, 0.88), wheel(-1.3, -0.88),
  ])
}

export function busGeometry(): THREE.BufferGeometry {
  const wheel = (x: number, z: number) => paint(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10).rotateX(Math.PI / 2).translate(x, 0.5, z), '#1b1b1d')
  return merge([
    part(10.4, 2.5, 2.5, 0, 0.45, 0, '#ffffff'),
    part(9.6, 0.9, 2.56, 0, 1.4, 0, '#4a6378'),
    part(10.4, 0.12, 2.6, 0, 2.93, 0, '#d9d9d9'),
    wheel(3.4, 1.25), wheel(3.4, -1.25), wheel(-3.4, 1.25), wheel(-3.4, -1.25),
  ])
}

/** Auto-rickshaw: yellow-and-black three-wheeler. */
export function autoGeometry(): THREE.BufferGeometry {
  return merge([
    part(2.5, 0.7, 1.3, 0, 0.3, 0, '#e8b50e'),
    part(1.5, 0.9, 1.25, -0.2, 0.95, 0, '#2a2a2a'),
    part(1.7, 0.1, 1.4, -0.2, 1.9, 0, '#202020'),
    paint(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 8).rotateX(Math.PI / 2).translate(1.0, 0.28, 0), '#101010'),
    paint(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 8).rotateX(Math.PI / 2).translate(-0.9, 0.28, 0.6), '#101010'),
    paint(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 8).rotateX(Math.PI / 2).translate(-0.9, 0.28, -0.6), '#101010'),
  ])
}

export function cowGeometry(): THREE.BufferGeometry {
  const leg = (x: number, z: number) => part(0.16, 0.7, 0.16, x, 0, z, '#d8c8b0')
  return merge([
    part(1.7, 0.85, 0.7, 0, 0.62, 0, '#ffffff'),
    part(0.55, 0.5, 0.42, 1.1, 0.95, 0, '#ffffff'),
    part(0.4, 0.2, 0.1, 1.15, 1.3, 0.28, '#c9b79b'),
    part(0.4, 0.2, 0.1, 1.15, 1.3, -0.28, '#c9b79b'),
    leg(0.65, 0.22), leg(0.65, -0.22), leg(-0.65, 0.22), leg(-0.65, -0.22),
  ])
}

/** Flat V of two wing triangles, forward +x. */
export function birdGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -1.2, 0.35, 1.6, 0.5, 0, 0, 0, 0, 0, 0.5, 0, 0, -1.2, 0.35, -1.6], 3))
  g.computeVertexNormals()
  return g
}

/** Teardrop map pin, apex at y = 0, about 2 units tall. */
export function pinGeometry(): THREE.BufferGeometry {
  const cone = new THREE.ConeGeometry(0.55, 1.3, 20).rotateX(Math.PI).translate(0, 0.65, 0)
  const ball = new THREE.SphereGeometry(0.62, 24, 16).translate(0, 1.4, 0)
  const hole = new THREE.SphereGeometry(0.24, 16, 12).translate(0, 1.45, 0.42)
  return merge([paint(cone, '#ffffff'), paint(ball, '#ffffff'), paint(hole, '#fff7ed')])
}

export function tentGeometry(): THREE.BufferGeometry {
  const roof = paint(new THREE.CylinderGeometry(0, 1, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5 + 0.5, 0), '#ffffff')
  const walls = paint(new THREE.BoxGeometry(1.2, 1, 1.2).translate(0, 0.5, 0), '#f1efe9')
  return merge([walls, roof])
}

export function lampGeometries() {
  const pole = merge([
    paint(new THREE.CylinderGeometry(0.1, 0.16, 8, 8).translate(0, 4, 0), '#8b9096'),
    paint(new THREE.BoxGeometry(2.2, 0.12, 0.12).translate(1.0, 7.9, 0), '#8b9096'),
  ])
  const head = paint(new THREE.BoxGeometry(0.9, 0.18, 0.4).translate(2.0, 7.8, 0), '#fff6d8')
  return { pole, head: clean(head) }
}

export function powerPoleGeometry(): THREE.BufferGeometry {
  return merge([
    paint(new THREE.CylinderGeometry(0.12, 0.18, 9, 6).translate(0, 4.5, 0), '#6b5a47'),
    paint(new THREE.BoxGeometry(0.12, 0.12, 2.4).translate(0, 8.4, 0), '#4b3f33'),
    paint(new THREE.BoxGeometry(0.12, 0.12, 1.6).translate(0, 7.6, 0), '#4b3f33'),
  ])
}

/** Relief-camp hall: plastered walls, a veranda slab and a low gable roof, forward +x, centred on the origin. */
export function hallGeometry(): THREE.BufferGeometry {
  const gable = new THREE.BufferGeometry()
  const rise = 0.35
  gable.setAttribute('position', new THREE.Float32BufferAttribute([0.5, 1, -0.5, 0.5, 1 + rise, 0, 0.5, 1, 0.5, -0.5, 1, 0.5, -0.5, 1 + rise, 0, -0.5, 1, -0.5], 3))
  paint(gable, '#f4f1ea')
  const roof = new THREE.BufferGeometry()
  const oh = 0.06
  roof.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5 - oh, 1, 0.5 + oh, 0.5 + oh, 1, 0.5 + oh, 0.5 + oh, 1 + rise + 0.03, 0, -0.5 - oh, 1, 0.5 + oh, 0.5 + oh, 1 + rise + 0.03, 0, -0.5 - oh, 1 + rise + 0.03, 0,
    0.5 + oh, 1, -0.5 - oh, -0.5 - oh, 1, -0.5 - oh, -0.5 - oh, 1 + rise + 0.03, 0, 0.5 + oh, 1, -0.5 - oh, -0.5 - oh, 1 + rise + 0.03, 0, 0.5 + oh, 1 + rise + 0.03, 0,
  ], 3))
  paint(roof, '#2f7d4f')
  return merge([paint(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), '#f4f1ea'), gable, roof])
}

export function jettyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [part(26, 0.5, 5, 0, 1.2, 0, '#8a6a45')]
  for (let x = -12; x <= 12; x += 6) for (const z of [-2.2, 2.2]) parts.push(part(0.5, 2, 0.5, x, -0.5, z, '#5d4630'))
  return merge(parts)
}

export function helicopterGroup(): THREE.Group {
  const g = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.35, metalness: 0.3 })
  const orange = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.4, metalness: 0.2 })
  const glass = new THREE.MeshStandardMaterial({ color: '#2b3c4d', roughness: 0.1, metalness: 0.6 })
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 14), white)
  body.scale.set(2.1, 1.1, 1.1)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), glass)
  nose.scale.set(1.2, 0.9, 0.95)
  nose.position.set(2.4, 0.15, 0)
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.55, 5.5, 8).rotateZ(Math.PI / 2), orange)
  tail.position.set(-5.2, 0.3, 0)
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 0.9), orange)
  fin.position.set(-7.7, 1.0, 0)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), white)
  mast.position.set(0, 1.9, 0)
  const rotor = new THREE.Group()
  rotor.name = 'rotor'
  rotor.position.set(0, 2.3, 0)
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.05, 0.35), new THREE.MeshStandardMaterial({ color: '#222' }))
    blade.rotation.y = (i * Math.PI) / 2
    rotor.add(blade)
  }
  const tailRotor = new THREE.Group()
  tailRotor.name = 'tailRotor'
  tailRotor.position.set(-7.7, 1.2, 0.55)
  tailRotor.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 0.2), new THREE.MeshStandardMaterial({ color: '#222' })))
  for (const z of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.4, 6).rotateZ(Math.PI / 2), white)
    skid.position.set(0.3, -1.5, z)
    g.add(skid)
    for (const x of [-1, 1.6]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), white)
      strut.position.set(x, -0.95, z)
      g.add(strut)
    }
  }
  g.add(body, nose, tail, fin, mast, rotor, tailRotor)
  g.traverse((o) => { o.castShadow = true })
  return g
}

/** White square with a green cross, for the front of a relief hall. */
export function crossTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = '#16a34a'
  ctx.fillRect(48, 16, 32, 96)
  ctx.fillRect(16, 48, 96, 32)
  ctx.strokeStyle = '#16a34a'
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, 122, 122)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function cloudTexture(seed = 1): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const ctx = c.getContext('2d')!
  let s = seed * 9301 + 49297
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  for (let i = 0; i < 26; i++) {
    const x = 40 + r() * 176
    const y = 50 + r() * 40
    const rad = 18 + r() * 34
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, rad, 0, Math.PI * 2)
    ctx.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Shop-front texture: shutters and a sign band on the ground floor, windows above. */
export function shopWallTexture(floors: number, seed: number): THREE.Texture {
  const W = 256
  const H = 96 * floors + 24
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  let s = seed * 7919
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  ctx.fillStyle = '#efece6'
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(90,80,60,${0.02 + r() * 0.05})`
    ctx.fillRect(r() * W, r() * H, 3 + r() * 10, 3 + r() * 16)
  }
  const shop = ['#b91c1c', '#1d4ed8', '#047857', '#b45309', '#7c3aed'][Math.floor(r() * 5)]
  for (let f = 0; f < floors; f++) {
    const y = f * 96 + 18
    const ground = f === floors - 1
    if (ground) {
      ctx.fillStyle = shop
      ctx.fillRect(0, y, W, 20)
      ctx.fillStyle = '#e5e7eb'
      for (let x = 10; x < W - 40; x += 64) {
        ctx.fillRect(x, y + 28, 52, 50)
        ctx.fillStyle = '#9ca3af'
        for (let l = 0; l < 6; l++) ctx.fillRect(x, y + 28 + l * 8, 52, 2)
        ctx.fillStyle = '#e5e7eb'
      }
    } else {
      for (let k = 0; k < 3; k++) {
        const x = 24 + k * 76
        ctx.fillStyle = '#4b3b2c'
        ctx.fillRect(x - 4, y + 4, 50, 52)
        ctx.fillStyle = '#2c3a46'
        ctx.fillRect(x, y + 8, 42, 44)
        ctx.fillStyle = 'rgba(180,210,230,0.3)'
        ctx.fillRect(x + 3, y + 11, 16, 38)
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.fillRect(x - 6, y + 56, 54, 6)
      }
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
