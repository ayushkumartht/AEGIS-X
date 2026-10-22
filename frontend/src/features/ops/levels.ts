import type { RiskLevel } from '@/api/types'

/** Colours for the risk levels and alert severities, shared by the map, badges and lists. */
export const LEVEL_COLOR: Record<RiskLevel, string> = {
  severe: '#dc2626',
  warning: '#f97316',
  watch: '#eab308',
  normal: '#22a06b',
  unknown: '#94a3b8',
}

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  severe: 'Severe',
  warning: 'Warning',
  watch: 'Watch',
  normal: 'Normal',
  unknown: 'No indicator',
}

export const SEVERITY_COLOR: Record<string, string> = {
  Extreme: '#7f1d1d',
  Severe: '#dc2626',
  Moderate: '#f97316',
  Minor: '#eab308',
  Unknown: '#94a3b8',
}

/** The hour and day an ISO time falls on, in the viewer's own time zone. */
export const when = (iso: string | null | undefined) => {
  if (!iso) return 'never'
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? iso : t.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

/** How long ago, for feed health: "4 min ago". */
export const ago = (iso: string | null | undefined) => {
  if (!iso) return 'never'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`
}
