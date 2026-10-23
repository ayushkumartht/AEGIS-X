import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

const PHOTOS = [
  {
    src: '/images/iaf-helicopter-rescue.jpg',
    place: 'Chennai',
    when: 'Dec 2015',
    line: 'Rooftop rescues begin when the roads are already gone.',
    alt: 'Indian Air Force helicopter winching a person off a rooftop surrounded by floodwater, Chennai 2015',
    credit: 'Indian Air Force · GODL-India',
  },
  {
    src: '/images/army-rescue.jpg',
    place: 'Chennai',
    when: '3 Dec 2015',
    line: 'Boats reach a street only after the water does.',
    alt: 'Army personnel evacuating residents by boat, Chennai 2015',
    credit: 'Ministry of Defence (PIB) · GODL-India',
  },
  {
    src: '/images/assam-dibrugarh.jpg',
    place: 'Dibrugarh, Assam',
    when: 'Aug 2015',
    line: 'A market street, under water overnight.',
    alt: 'Flooded market street in Dibrugarh, Assam, August 2015',
    credit: 'Arunabh0368 · CC BY-SA 4.0',
  },
  {
    src: '/images/navy-relief.jpg',
    place: 'Chennai',
    when: 'Dec 2015',
    line: 'Relief runs on boats, and there are never enough of them.',
    alt: 'Indian Navy inflatable rescue boat with residents in floodwater, Chennai 2015',
    credit: 'Indian Navy · GODL-India',
  },
  {
    src: '/images/chennai-street.jpg',
    place: 'Nandanam, Chennai',
    when: '3 Dec 2015',
    line: 'Every flooded road slows every vehicle in the plan.',
    alt: 'Residents wading through a waterlogged street in Nandanam, Chennai',
    credit: 'Vijayingarsal · CC0',
  },
  {
    src: '/images/assam-village.jpg',
    place: 'Karimganj, Assam',
    when: 'Jun 2024',
    line: 'Villages cut off for days, waiting for the next wave.',
    alt: 'Floodwater around houses in a village in Karimganj district, Assam, June 2024',
    credit: 'KEmel49 · CC BY-SA 4.0',
  },
]

const STEP_MS = 5000

/**
 * Expanding photo panels: hover, focus or tap one to open it. It advances on
 * its own while on screen, and stops for good once someone picks a photo.
 */
export function FloodGallery() {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-120px' })
  const [active, setActive] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [picked, setPicked] = useState(false)

  const playing = inView && !hovering && !picked && !reduce

  useEffect(() => {
    if (!playing) return
    const id = window.setTimeout(() => setActive((i) => (i + 1) % PHOTOS.length), STEP_MS)
    return () => window.clearTimeout(id)
  }, [active, playing])

  const choose = (i: number) => {
    setActive(i)
    setPicked(true)
  }

  return (
    <div
      ref={ref}
      className="flex h-[640px] flex-col gap-2 md:h-[520px] md:flex-row"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      role="tablist"
      aria-label="Flood photographs"
    >
      {PHOTOS.map((p, i) => {
        const open = i === active
        return (
          <button
            key={p.src}
            type="button"
            role="tab"
            aria-selected={open}
            aria-label={`${p.place}, ${p.when}: ${p.line}`}
            onClick={() => choose(i)}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            className="group relative min-h-0 min-w-0 basis-0 overflow-hidden rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{ flexGrow: open ? 6 : 1, transition: 'flex-grow 0.7s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <img
              src={p.src}
              alt={p.alt}
              loading="lazy"
              className={cn('absolute inset-0 size-full object-cover transition-transform duration-[1.6s] ease-out', open ? 'scale-100' : 'scale-110')}
            />
            <div className={cn('absolute inset-0 transition-colors duration-700', open ? 'bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent' : 'bg-slate-950/55 group-hover:bg-slate-950/40')} />

            {/* closed: place name, vertical on wide screens */}
            <span
              className={cn(
                'absolute bottom-4 left-4 text-sm font-medium text-white/85 transition-opacity duration-300 md:[writing-mode:vertical-rl] md:rotate-180',
                open ? 'opacity-0' : 'opacity-100',
              )}
            >
              {p.place}
            </span>

            {/* open: the story */}
            <AnimatePresence>
              {open && (
                <motion.div
                  className="absolute inset-x-0 bottom-0 p-6 text-white md:p-8"
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, delay: reduce ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="text-xs font-medium text-sky-200">
                    {p.place} · {p.when}
                  </p>
                  <p className="mt-2 max-w-lg text-xl leading-snug font-semibold tracking-tight text-balance md:text-2xl">{p.line}</p>
                  <p className="mt-3 text-[10px] text-white/50">{p.credit}</p>
                  {playing && (
                    <span className="mt-4 block h-0.5 w-24 overflow-hidden rounded-full bg-white/20">
                      <motion.span
                        key={`bar-${active}`}
                        className="block h-full bg-white"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
                      />
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        )
      })}
    </div>
  )
}
