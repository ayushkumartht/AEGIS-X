// Map pin icons drawn with the 2D canvas and cached as data URLs for Cesium billboards.

const cache = new Map<string, string>()

function draw(key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): string {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  paint(ctx)
  const url = c.toDataURL('image/png')
  cache.set(key, url)
  return url
}

/** Teardrop pin: round head at (cx, cy) with radius r, tip at the bottom. */
function pin(ctx: CanvasRenderingContext2D, fill: string, cx = 40, cy = 38, r = 28) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 3
  ctx.beginPath()
  ctx.moveTo(cx, cy + r + 20)
  ctx.bezierCurveTo(cx - r * 0.55, cy + r * 0.8, cx - r, cy + r * 0.45, cx - r, cy)
  ctx.arc(cx, cy, r, Math.PI, 0)
  ctx.bezierCurveTo(cx + r, cy + r * 0.45, cx + r * 0.55, cy + r * 0.8, cx, cy + r + 20)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 4
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.restore()
}

const short = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

/** Settlement pin showing the population; red when flooded. */
export function clusterIcon(population: number, flooded: boolean): string {
  return draw(`cluster:${short(population)}:${flooded}`, 80, 100, (ctx) => {
    pin(ctx, flooded ? '#dc2626' : '#f59e0b')
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 22px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(short(population), 40, 38)
  })
}

/** Shelter pin with a house-and-cross glyph; grey when flooded, dashed ring when assumed. */
export function shelterIcon(flooded: boolean, assumed: boolean): string {
  return draw(`shelter:${flooded}:${assumed}`, 80, 100, (ctx) => {
    pin(ctx, flooded ? '#6b7280' : assumed ? '#4ade80' : '#16a34a')
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(40, 18)
    ctx.lineTo(60, 36)
    ctx.lineTo(54, 36)
    ctx.lineTo(54, 56)
    ctx.lineTo(26, 56)
    ctx.lineTo(26, 36)
    ctx.lineTo(20, 36)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = flooded ? '#6b7280' : '#16a34a'
    ctx.fillRect(37, 34, 6, 18)
    ctx.fillRect(31, 40, 18, 6)
  })
}

/** Boat-base pin with a small boat glyph. */
export function stagingIcon(): string {
  return draw('staging', 80, 100, (ctx) => {
    pin(ctx, '#7c3aed')
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(20, 42)
    ctx.lineTo(60, 42)
    ctx.lineTo(52, 54)
    ctx.lineTo(28, 54)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(40, 18)
    ctx.lineTo(54, 38)
    ctx.lineTo(40, 38)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(38, 18, 3, 22)
  })
}
