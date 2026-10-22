import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Bot, Check, CircleHelp, ClipboardList, Coins, Eye, FileSearch, Flame, ListChecks, MapPinned, ShieldQuestion, Sparkles, Target, X,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/api/client'
import type { Brief, BriefItem, EvidenceItem, Recommendation } from '@/api/types'
import { ActionButton, Empty, IconChip, Panel, Pill, type Tone } from '@/components/viz/kit'
import { when } from './levels'

const SECTIONS: [keyof Brief['sections'], string, LucideIcon, Tone][] = [
  ['situation', 'Situation', Eye, 'primary'],
  ['worst', 'Where it is worst', Flame, 'risk'],
  ['check_first', 'Check first', ListChecks, 'safe'],
  ['uncertainty', 'What is uncertain', ShieldQuestion, 'warn'],
]

const isExercise = (b: Brief) => b.evidence.some((e) => e.kind === 'exercise')

/** Evidence chip: the id a statement cites, with what it stands for on hover. */
function Cite({ id, evidence }: { id: string; evidence: Map<string, EvidenceItem> }) {
  const item = evidence.get(id)
  return (
    <span className="ml-1 inline-block rounded bg-primary/10 px-1.5 py-px align-middle text-[10px] font-semibold text-primary" title={item ? `${item.kind}: ${item.title}` : id}>
      {id}
    </span>
  )
}

function Items({ items, evidence }: { items: BriefItem[]; evidence: Map<string, EvidenceItem> }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">Nothing to report.</p>
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-[13px] leading-snug">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
          <span>{it.text}{it.evidence.map((id) => <Cite key={id} id={id} evidence={evidence} />)}</span>
        </li>
      ))}
    </ul>
  )
}

function RecommendationCard({ rec, n, evidence, onDone }: { rec: Recommendation; n: number; evidence: Map<string, EvidenceItem>; onDone: () => void }) {
  const [note, setNote] = useState('')
  const decide = useMutation({ mutationFn: (action: 'accept' | 'reject') => api.opsDecide(rec.id, action, note), onSuccess: onDone })
  const rows: [string, string, LucideIcon][] = [['Why', rec.why, CircleHelp], ['What it buys', rec.gain, Target], ['What it costs', rec.cost, Coins], ['What could break it', rec.risk, AlertTriangle]]
  const status = rec.status
  return (
    <li className={`rounded-xl border p-3.5 ${status === 'accepted' ? 'border-safe/50 bg-safe/5' : status === 'rejected' ? 'border-risk/40 bg-risk/5 opacity-80' : 'bg-card'}`}>
      <div className="flex items-start gap-2.5">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
        <p className="flex-1 font-semibold leading-snug">{rec.action}</p>
        {status !== 'proposed' && <Pill tone={status === 'accepted' ? 'safe' : 'risk'}>{status} by {rec.decided_by}</Pill>}
      </div>
      <dl className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
        {rows.map(([k, v, Icon]) => (
          <div key={k} className="rounded-lg bg-muted/60 px-2.5 py-1.5">
            <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><Icon className="size-3" aria-hidden />{k}</dt>
            <dd className="mt-0.5 text-xs leading-snug">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 text-[11px] text-muted-foreground">Based on {rec.evidence.map((id) => <Cite key={id} id={id} evidence={evidence} />)}</div>
      {status === 'proposed' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <input className="min-w-40 flex-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs" placeholder="Note for the log (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note for the decision log" />
          <ActionButton size="sm" variant="success" icon={Check} busy={decide.isPending && decide.variables === 'accept'} onClick={() => decide.mutate('accept')} disabled={decide.isPending}>Accept</ActionButton>
          <ActionButton size="sm" variant="danger" icon={X} busy={decide.isPending && decide.variables === 'reject'} onClick={() => decide.mutate('reject')} disabled={decide.isPending}>Reject</ActionButton>
          {decide.isError && <span className="w-full text-xs text-risk" role="alert">{String(decide.error.message)}</span>}
        </div>
      )}
    </li>
  )
}

export function BriefPanel({ mode, exercise }: { mode: string; exercise: boolean }) {
  const qc = useQueryClient()
  const allPast = useQuery({ queryKey: ['ops-briefs'], queryFn: api.opsBriefs, retry: false })
  // live briefs and exercise briefs are kept apart: the screen shows the ones that match its data source
  const past = allPast.data?.filter((b) => isExercise(b) === exercise)
  const make = useMutation({
    mutationFn: () => api.opsBrief(mode, exercise),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops-briefs'] }),
  })
  const [openId, setOpenId] = useState<number | null>(null)
  const justMade = make.data && isExercise(make.data) === exercise ? make.data : undefined
  const brief: Brief | undefined = (openId ? past?.find((b) => b.id === openId) : undefined) ?? justMade ?? past?.[0]
  const evidence = new Map((brief?.evidence ?? []).map((e) => [e.id, e]))
  const refreshBriefs = () => {
    qc.invalidateQueries({ queryKey: ['ops-briefs'] })
    qc.invalidateQueries({ queryKey: ['integrity'] })
  }
  const generate = (
    <ActionButton icon={Sparkles} busy={make.isPending} busyText="Working it out (up to a minute)" onClick={() => { setOpenId(null); make.mutate() }}>
      {exercise ? 'Generate brief for the exercise' : 'Generate brief'}
    </ActionButton>
  )

  return (
    <Panel
      icon={Bot}
      title="AI strategy brief"
      hint="Reads only the official alerts, river forecasts and tested evacuation results listed as evidence. It recommends; you accept or reject, and every decision goes into the tamper-evident log."
      action={generate}
    >
      {make.isError && <p className="mb-2 text-sm text-risk" role="alert">{String(make.error.message)}</p>}
      {!brief && !make.isPending && (
        <Empty icon={ClipboardList} title="No brief yet" body="Generate one for the situation as it is now. It takes a few seconds, or up to a minute the first time the evacuation engine runs." />
      )}
      {brief && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {isExercise(brief) && <Pill className="bg-amber-500 text-black">SIMULATED EXERCISE</Pill>}
            <Pill tone={brief.source === 'rules' ? 'neutral' : 'safe'}>{brief.source === 'rules' ? 'written by rules, no AI text' : `written by ${brief.source} ${brief.model}, checked against the evidence`}</Pill>
            <span className="text-muted-foreground">Brief #{brief.id} · {when(brief.created_at)} · {brief.mode.replace(/_/g, ' ')} · by {brief.author}</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {SECTIONS.slice(0, 2).map(([key, title, Icon, tone]) => (
              <div key={key} className="rounded-xl border p-3">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><IconChip icon={Icon} tone={tone} className="size-6" />{title}</h4>
                <Items items={brief.sections[key] as BriefItem[]} evidence={evidence} />
              </div>
            ))}
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><IconChip icon={MapPinned} className="size-6" />Recommended actions</h4>
            {brief.recommendations.length === 0 ? (
              <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">No action recommended: nothing in the evidence is at watch level or above. Keep monitoring.</p>
            ) : (
              <ol className="space-y-2.5">
                {brief.recommendations.map((r, i) => <RecommendationCard key={r.id} rec={r} n={i + 1} evidence={evidence} onDone={refreshBriefs} />)}
              </ol>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {SECTIONS.slice(2).map(([key, title, Icon, tone]) => (
              <div key={key} className="rounded-xl border p-3">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><IconChip icon={Icon} tone={tone} className="size-6" />{title}</h4>
                <Items items={brief.sections[key] as BriefItem[]} evidence={evidence} />
              </div>
            ))}
          </div>

          <details className="rounded-xl border p-3">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><FileSearch className="size-4 text-muted-foreground" aria-hidden />Evidence behind this brief ({brief.evidence.length})</summary>
            <ul className="mt-2 space-y-1.5 text-xs">
              {brief.evidence.map((e) => (
                <li key={e.id}>
                  <Cite id={e.id} evidence={evidence} /> <strong>{e.title}</strong> <span className="text-muted-foreground">({e.kind})</span>
                  <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-[11px]">{JSON.stringify(e.data, null, 1)}</pre>
                </li>
              ))}
            </ul>
          </details>

          {past && past.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Earlier briefs:</span>
              {past.slice(0, 8).map((b) => (
                <button key={b.id} className={`rounded-full border px-2.5 py-0.5 transition-colors ${b.id === brief.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'}`} onClick={() => setOpenId(b.id)}>#{b.id}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}
