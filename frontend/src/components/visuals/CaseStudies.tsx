import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, CircleCheck, MapPin } from 'lucide-react'
import { CASE_STUDIES } from '@/content/caseStudies'
import { cn } from '@/lib/utils'

const FACT_TONES = ['text-primary', 'text-flood', 'text-risk']

export function CaseStudies() {
  const [activeId, setActiveId] = useState(CASE_STUDIES[0].id)
  const cs = CASE_STUDIES.find((c) => c.id === activeId) ?? CASE_STUDIES[0]

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* selector */}
      <div role="tablist" aria-label="Case studies" className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
        {CASE_STUDIES.map((c) => {
          const active = c.id === activeId
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveId(c.id)}
              className={cn(
                'group relative flex min-w-56 items-center gap-3 overflow-hidden rounded-xl border p-2.5 text-left transition-all lg:min-w-0',
                active ? 'border-primary/40 bg-primary/5 shadow-sm' : 'bg-background hover:bg-muted/60',
              )}
            >
              <img src={c.image} alt="" className="size-12 shrink-0 rounded-lg object-cover" loading="lazy" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{c.place}</span>
                <span className="block text-xs text-muted-foreground">{c.when}</span>
              </span>
              {active && <motion.span layoutId="cs-indicator" className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />}
            </button>
          )
        })}
      </div>

      {/* detail */}
      <AnimatePresence mode="wait">
        <motion.article
          key={cs.id}
          role="tabpanel"
          className="overflow-hidden rounded-2xl border bg-card shadow-[0_20px_60px_-30px_rgba(30,58,138,0.35)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative h-64 overflow-hidden md:h-80">
            <motion.img
              src={cs.image}
              alt={cs.imageAlt}
              className="size-full object-cover"
              initial={{ scale: 1.08 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-200">
                <MapPin className="size-3.5" /> {cs.place} · {cs.when}
              </p>
              <h3 className="mt-1.5 text-2xl font-semibold tracking-tight md:text-3xl">{cs.title}</h3>
            </div>
            <span className="absolute top-3 right-3 rounded-full bg-black/45 px-2.5 py-1 font-mono text-[10px] text-white/85 backdrop-blur">{cs.imageCredit}</span>
          </div>

          <div className="grid gap-px border-b bg-border sm:grid-cols-3">
            {cs.facts.map((f, i) => (
              <div key={f.label} className="bg-card p-5">
                <p className={cn('text-2xl font-semibold tracking-tight md:text-3xl', FACT_TONES[i % FACT_TONES.length])}>{f.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-8 p-6 md:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] tracking-wider text-risk uppercase">The decision problem</p>
              <p className="mt-2 leading-relaxed text-foreground/85">{cs.challenge}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] tracking-wider text-primary uppercase">What AEGIS-X would test</p>
              <ul className="mt-2 space-y-2">
                {cs.aegis.map((a) => (
                  <li key={a} className="flex gap-2 text-sm text-foreground/85">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-safe" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-6 py-3 text-xs text-muted-foreground">
            <span>Figures quoted from the source; the response is illustrative of the approach, not a re-run of this event.</span>
            <a href={cs.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {cs.source.label} <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </motion.article>
      </AnimatePresence>
    </div>
  )
}
