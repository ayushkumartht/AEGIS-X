import { useState, type ReactNode } from 'react'
import { Check, Copy, Info, Lightbulb, Link2, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DocH2({ id, children, kicker }: { id: string; children: ReactNode; kicker?: string }) {
  return (
    <div className="mt-20 scroll-mt-24 border-t pt-10" id={id} data-doc-heading>
      {kicker && <p className="mb-2 font-mono text-[11px] font-medium tracking-widest text-primary uppercase">{kicker}</p>}
      <h2 className="group text-2xl font-semibold tracking-tight md:text-3xl">
        <a href={`#${id}`} className="inline-flex items-center gap-2">
          {children}
          <Link2 className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </a>
      </h2>
    </div>
  )
}

export function DocH3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} data-doc-heading className="mt-12 scroll-mt-24 text-lg font-semibold tracking-tight">
      {children}
    </h3>
  )
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-4 leading-7 text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground', className)}>{children}</p>
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-md border border-primary/15 bg-primary/5 px-1.5 py-0.5 font-mono text-[0.85em] text-primary">{children}</code>
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 leading-7 text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
          <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

const CALLOUT_TONES = {
  info: { icon: Info, box: 'border-primary/20 bg-primary/5', icon_: 'text-primary' },
  tip: { icon: Lightbulb, box: 'border-safe/25 bg-safe/5', icon_: 'text-safe' },
  warn: { icon: TriangleAlert, box: 'border-warn/40 bg-warn/10', icon_: 'text-amber-600' },
}

export function Callout({ children, tone = 'info', title }: { children: ReactNode; tone?: keyof typeof CALLOUT_TONES; title?: string }) {
  const t = CALLOUT_TONES[tone]
  const Icon = t.icon
  return (
    <div className={cn('mt-6 flex gap-3 rounded-xl border p-4 text-sm', t.box)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', t.icon_)} />
      <div className="leading-6 text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        {title && <p className="mb-1 font-medium text-foreground">{title}</p>}
        {children}
      </div>
    </div>
  )
}

export function CodeBlock({ code, title, lang }: { code: string; title?: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-lg shadow-slate-900/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
          <span className="flex gap-1">
            <span className="size-2 rounded-full bg-rose-400/80" />
            <span className="size-2 rounded-full bg-amber-300/80" />
            <span className="size-2 rounded-full bg-emerald-400/80" />
          </span>
          {title ?? lang ?? 'code'}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            })
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Copy code"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function DataTable({ head, rows, mono = [] }: { head: string[]; rows: ReactNode[][]; mono?: number[] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-accent/60">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium whitespace-nowrap text-accent-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t align-top transition-colors hover:bg-muted/40">
              {row.map((cell, j) => (
                <td key={j} className={cn('px-4 py-3 text-muted-foreground', j === 0 && 'text-foreground', mono.includes(j) && 'font-mono text-xs')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Figure({ children, caption }: { children: ReactNode; caption: ReactNode }) {
  return (
    <figure className="mt-8">
      {children}
      <figcaption className="mt-3 text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  )
}
