import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useScenarioStore } from '../../state/scenarioStore'

const CANVAS_SIZE = 520

function elevationColor(value: number, min: number, max: number): string {
  const t = max > min ? (value - min) / (max - min) : 0
  // low elevation (flood-prone) = darker green-blue, high = tan/brown
  const r = Math.round(60 + t * 150)
  const g = Math.round(110 + t * 80)
  const b = Math.round(90 + t * 40)
  return `rgb(${r},${g},${b})`
}

export function GridCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const conditions = useScenarioStore((s) => s.conditions)
  const highlightedElement = useScenarioStore((s) => s.highlightedElement)

  const { data: scenario } = useQuery({
    queryKey: ['demo-scenario'],
    queryFn: api.getDemoScenario,
    staleTime: Infinity, // the demo scenario is fixed (seeded) for the session
  })

  const { data: floodState } = useQuery({
    queryKey: ['flood-state', conditions.rainfall_mm],
    queryFn: () => api.getFloodState({ rainfall_mm: conditions.rainfall_mm }),
    enabled: !!scenario,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !scenario) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [rows, cols] = scenario.grid_size
    const cell = CANVAS_SIZE / Math.max(rows, cols)

    let min = Infinity
    let max = -Infinity
    for (const row of scenario.elevation) {
      for (const v of row) {
        if (v < min) min = v
        if (v > max) max = v
      }
    }

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // elevation + flood overlay
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const flooded = floodState?.flooded?.[r]?.[c]
        ctx.fillStyle = flooded
          ? 'rgba(37, 99, 235, 0.75)' // flooded = blue
          : elevationColor(scenario.elevation[r][c], min, max)
        ctx.fillRect(c * cell, r * cell, cell, cell)
      }
    }

    // roads
    ctx.fillStyle = 'rgba(30, 30, 30, 0.55)'
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (scenario.roads[r][c]) {
          ctx.fillRect(c * cell + cell * 0.35, r * cell + cell * 0.35, cell * 0.3, cell * 0.3)
        }
      }
    }

    // population clusters
    scenario.population_clusters.forEach((pc, i) => {
      const [r, c] = pc.pos
      const radius = Math.min(cell * 0.6, 4 + pc.count / 20)
      ctx.beginPath()
      ctx.arc(c * cell + cell / 2, r * cell + cell / 2, radius, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(249, 115, 22, 0.9)'
      ctx.fill()
      ctx.fillStyle = 'white'
      ctx.font = '9px sans-serif'
      ctx.fillText(`${pc.count}`, c * cell + cell / 2 - 8, r * cell + cell / 2 + 3)
      void i
    })

    // shelters
    scenario.shelters.forEach(([r, c], i) => {
      const isHighlighted = highlightedElement === `shelter_${i}`
      ctx.beginPath()
      ctx.arc(c * cell + cell / 2, r * cell + cell / 2, cell * 0.45, 0, Math.PI * 2)
      ctx.fillStyle = isHighlighted ? '#facc15' : '#22c55e'
      ctx.fill()
      ctx.strokeStyle = isHighlighted ? '#facc15' : 'white'
      ctx.lineWidth = isHighlighted ? 3 : 1
      ctx.stroke()
      ctx.fillStyle = 'black'
      ctx.font = 'bold 9px sans-serif'
      ctx.fillText(`S${i}`, c * cell + cell / 2 - 7, r * cell + cell / 2 + 3)
    })

    // bridges
    Object.entries(scenario.bridges).forEach(([name, [r, c]]) => {
      const isHighlighted = highlightedElement === `bridge_${name}`
      ctx.beginPath()
      ctx.rect(c * cell + cell * 0.15, r * cell + cell * 0.15, cell * 0.7, cell * 0.7)
      ctx.strokeStyle = isHighlighted ? '#ef4444' : '#94a3b8'
      ctx.lineWidth = isHighlighted ? 4 : 2
      ctx.stroke()
      if (isHighlighted) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)'
        ctx.fill()
      }
    })
  }, [scenario, floodState, highlightedElement])

  return (
    <div className="bg-slate-900 rounded-lg p-3 flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-slate-200">Situation Map</h2>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="rounded border border-slate-700 w-full h-auto"
      />
      <div className="flex gap-4 text-xs text-slate-400">
        <span><span className="inline-block w-3 h-3 bg-blue-600 mr-1" /> Flooded</span>
        <span><span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-1" /> Shelter</span>
        <span><span className="inline-block w-3 h-3 bg-orange-500 rounded-full mr-1" /> Population</span>
        <span><span className="inline-block w-3 h-3 border-2 border-slate-400 mr-1" /> Bridge</span>
      </div>
      {floodState && (
        <p className="text-xs text-slate-500">
          Water level: {floodState.water_level_m.toFixed(2)} m
        </p>
      )}
    </div>
  )
}
