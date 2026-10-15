import { useCallback, useRef, useState } from 'react'
import { MoveHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Drag-to-compare image slider (pointer + keyboard accessible). */
export function BeforeAfter({
  before,
  after,
  beforeLabel,
  afterLabel,
  alt,
  className,
}: {
  before: string
  after: string
  beforeLabel: string
  afterLabel: string
  alt: string
  className?: string
}) {
  const [pos, setPos] = useState(50)
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const update = useCallback((clientX: number) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)))
  }, [])

  return (
    <div
      ref={ref}
      className={cn('relative cursor-ew-resize touch-none overflow-hidden rounded-xl border select-none', className)}
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        update(e.clientX)
      }}
      onPointerMove={(e) => dragging.current && update(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <img src={after} alt={`${alt}: ${afterLabel}`} className="block size-full object-cover" draggable={false} />
      <img
        src={before}
        alt={`${alt}: ${beforeLabel}`}
        className="absolute inset-0 block size-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />

      <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[10px] tracking-wider text-black uppercase backdrop-blur">
        {beforeLabel}
      </span>
      <span className="absolute top-3 right-3 rounded-full bg-black/80 px-2.5 py-1 font-mono text-[10px] tracking-wider text-white uppercase backdrop-blur">
        {afterLabel}
      </span>

      <div className="absolute inset-y-0 w-px bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.2)]" style={{ left: `${pos}%` }}>
        <button
          type="button"
          role="slider"
          aria-label="Compare before and after"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 5))
            if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 5))
          }}
          className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          <MoveHorizontal className="size-4" />
        </button>
      </div>
    </div>
  )
}
