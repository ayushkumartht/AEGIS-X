import { Link } from 'react-router-dom'
import { Logo } from '@/components/site/Logo'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { to: '/#how-it-works', label: 'How it works' },
      { to: '/#platform', label: 'Platform' },
      { to: '/#architecture', label: 'Architecture' },
      { to: '/demo', label: 'Live demo' },
    ],
  },
  {
    title: 'Documentation',
    links: [
      { to: '/docs#overview', label: 'Overview' },
      { to: '/docs#problem', label: 'The problem' },
      { to: '/docs#architecture', label: 'Architecture' },
      { to: '/docs#api', label: 'API reference' },
    ],
  },
  {
    title: 'Project',
    links: [
      { to: '/docs#findings', label: 'Measured findings' },
      { to: '/docs#limitations', label: 'Limitations' },
      { to: '/docs#roadmap', label: 'Roadmap' },
      { to: '/docs#credits', label: 'Image credits' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">Test the decision before reality does.</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Built for INNOTECH. A decision-support tool: the final call always stays with an authorized human.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="mb-3 text-sm font-medium">{col.title}</p>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          Satellite imagery courtesy of NASA Earth Observatory (no endorsement implied). Rescue photographs: Indian Air Force, Ministry of Defence /
          PIB and Indian Navy under GODL-India; community photographs under CC0 and CC BY-SA 4.0. Case-study figures: NASA, IFRC, UNICEF. Full
          attributions in{' '}
          <Link to="/docs#credits" className="underline underline-offset-4 hover:text-foreground">
            image credits
          </Link>
          .
        </p>
      </div>
    </footer>
  )
}
