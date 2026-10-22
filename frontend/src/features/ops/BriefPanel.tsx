import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Brief, BriefItem, EvidenceItem, Recommendation } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { canWrite, useAuth } from '@/state/authStore'
import { when } from './levels'

const SECTION_TITLES: [keyof Brief['sections'], string][] = [
  ['situation', 'Situation'],
  ['worst', 'Where it is worst'],
  ['check_first', 'Check first'],
  ['uncertainty', 'What is uncertain'],
]

/** Evidence chip: the id the statement cites, with what it stands for on hover. */
function Cite({ id, evidence }: { id: string; evidence: Map<string, EvidenceItem> }) {
  const item = evidence.get(id)
  return (
    <span className="mr-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title={item ? `${item.kind}: ${item.title}` : id}>
      {id}
    </span>
  )
}

function Items({ items, evidence }: { items: BriefItem[]; evidence: Map<string, EvidenceItem> }) {
  if (!items.length) return <p className="text-muted-foreground">Nothing to report.</p>
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i}>
          {it.text} <span className="whitespace-nowrap">{it.evidence.map((id) => <Cite key={id} id={id} evidence={evidence} />)}</span>
        </li>
      ))}
    </ul>
  )
}

function RecommendationCard({ rec, evidence, canDecide, onDone }: { rec: Recommendation; evidence: Map<string, EvidenceItem>; canDecide: boolean; onDone: () => void }) {
  const [note, setNote] = useState('')
  const decide = useMutation({ mutationFn: (action: 'accept' | 'reject') => api.opsDecide(rec.id, action, note), onSuccess: onDone })
  const rows: [string, string][] = [['Why', rec.why], ['What it buys', rec.gain], ['What it costs', rec.cost], ['What could break it', rec.risk]]
  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-start gap-2">
        <p className="flex-1 font-medium">{rec.action}</p>
        {rec.status !== 'proposed' && <Badge variant={rec.status === 'accepted' ? 'default' : 'destructive'}>{rec.status} by {rec.decided_by?.split(' <')[0]}</Badge>}
      </div>
      <dl className="mt-1.5 grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[8rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
        ))}
        <dt className="text-muted-foreground">Based on</dt>
        <dd>{rec.evidence.map((id) => <Cite key={id} id={id} evidence={evidence} />)}</dd>
      </dl>
      {rec.status === 'proposed' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {canDecide ? (
            <>
              <input className="min-w-40 flex-1 rounded-lg border bg-background px-2 py-1 text-xs" placeholder="Note (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note for the decision log" />
              <Button size="sm" onClick={() => decide.mutate('accept')} disabled={decide.isPending}>Accept</Button>
              <Button size="sm" variant="outline" onClick={() => decide.mutate('reject')} disabled={decide.isPending}>Reject</Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Sign in as an officer to accept or reject.</span>
          )}
          {decide.isError && <span className="text-xs text-risk" role="alert">{String(decide.error.message)}</span>}
        </div>
      )}
    </li>
  )
}

export function BriefPanel({ mode }: { mode: string }) {
  const user = useAuth((s) => s.user)
  const location = useLocation()
  const qc = useQueryClient()
  const allowed = canWrite(user)
  const past = useQuery({ queryKey: ['ops-briefs'], queryFn: api.opsBriefs, enabled: allowed, retry: false })
  const make = useMutation({
    mutationFn: () => api.opsBrief(mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops-briefs'] }),
  })
  const [openId, setOpenId] = useState<number | null>(null)
  const brief: Brief | undefined = (openId ? past.data?.find((b) => b.id === openId) : undefined) ?? make.data ?? past.data?.[0]
  const evidence = new Map((brief?.evidence ?? []).map((e) => [e.id, e]))
  const refreshBriefs = () => qc.invalidateQueries({ queryKey: ['ops-briefs'] })

  return (
    <section className="rounded-xl border bg-card p-4 text-sm" aria-label="AI strategy brief">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold">Strategy brief</h2>
        {brief && <Badge variant="outline">{brief.source === 'rules' ? 'written by rules (no AI text)' : `written by ${brief.source} ${brief.model}, checked against the evidence`}</Badge>}
        <div className="ml-auto flex items-center gap-2">
          {allowed ? (
            <Button size="sm" onClick={() => { setOpenId(null); make.mutate() }} disabled={make.isPending}>
              {make.isPending ? 'Working it out (up to a minute)' : 'Generate brief'}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground"><Link className="font-medium underline" to={`/login?next=${encodeURIComponent(location.pathname)}`}>Sign in</Link> as an officer to generate a brief.</span>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        The advisor reads only the official alerts, river forecasts and tested evacuation results listed below it. It recommends; people accept or reject, and every decision goes into the tamper-evident log.
      </p>
      {make.isError && <p className="mt-2 text-risk" role="alert">{String(make.error.message)}</p>}

      {!brief && !make.isPending && <p className="mt-3 text-muted-foreground">{allowed ? 'No brief yet. Generate one for the situation as it is now.' : 'Briefs are written for signed-in officers.'}</p>}
      {brief && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-muted-foreground">Brief #{brief.id}, {when(brief.created_at)}, for {brief.mode.replace(/_/g, ' ')}, by {brief.author.split(' <')[0]}.</p>
          {SECTION_TITLES.slice(0, 2).map(([key, title]) => (
            <div key={key}><h3 className="mb-1 font-semibold">{title}</h3><Items items={brief.sections[key] as BriefItem[]} evidence={evidence} /></div>
          ))}
          <div>
            <h3 className="mb-1 font-semibold">Recommended actions</h3>
            {brief.recommendations.length === 0 ? (
              <p className="text-muted-foreground">No action recommended: nothing in the evidence is at watch level or above. Keep monitoring.</p>
            ) : (
              <ul className="space-y-2">
                {brief.recommendations.map((r) => <RecommendationCard key={r.id} rec={r} evidence={evidence} canDecide={allowed} onDone={refreshBriefs} />)}
              </ul>
            )}
          </div>
          {SECTION_TITLES.slice(2).map(([key, title]) => (
            <div key={key}><h3 className="mb-1 font-semibold">{title}</h3><Items items={brief.sections[key] as BriefItem[]} evidence={evidence} /></div>
          ))}
          <details>
            <summary className="cursor-pointer font-semibold">Evidence behind this brief ({brief.evidence.length})</summary>
            <ul className="mt-2 space-y-1.5 text-xs">
              {brief.evidence.map((e) => (
                <li key={e.id}>
                  <Cite id={e.id} evidence={evidence} /> <strong>{e.title}</strong> <span className="text-muted-foreground">({e.kind})</span>
                  <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px]">{JSON.stringify(e.data, null, 1)}</pre>
                </li>
              ))}
            </ul>
          </details>
          {past.data && past.data.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Earlier briefs:</span>
              {past.data.slice(0, 6).map((b) => (
                <button key={b.id} className={`rounded border px-2 py-0.5 ${b.id === brief.id ? 'bg-accent font-medium' : ''}`} onClick={() => setOpenId(b.id)}>#{b.id}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
