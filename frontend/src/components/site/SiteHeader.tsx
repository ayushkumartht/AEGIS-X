import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/site/Logo'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#case-studies', label: 'Case studies' },
  { href: '/#platform', label: 'Platform' },
  { href: '/#architecture', label: 'Architecture' },
  { href: '/docs', label: 'Documentation' },
]

/**
 * `overlay`: the header floats over a full-bleed dark hero (white text, no
 * background) until the page is scrolled, then becomes the normal solid bar.
 */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const solid = scrolled || open
  const onDark = overlay && !solid

  return (
    <header
      className={cn(
        'top-0 z-50 transition-all duration-300',
        overlay ? 'fixed inset-x-0' : 'sticky',
        solid ? 'border-b bg-background/85 backdrop-blur-xl' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link to="/" aria-label="AEGIS-X home" onClick={() => setOpen(false)} className={cn('transition-colors', onDark && 'text-white')}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const base = 'rounded-md px-3 py-2 text-sm transition-colors'
            const tone = onDark ? 'text-white/75 hover:text-white' : 'text-muted-foreground hover:text-foreground'
            return l.href.startsWith('/#') ? (
              <Link key={l.href} to={l.href} className={cn(base, tone)}>
                {l.label}
              </Link>
            ) : (
              <NavLink key={l.href} to={l.href} className={({ isActive }) => cn(base, tone, isActive && !onDark && 'text-foreground')}>
                {l.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="hidden md:block">
          <Button asChild size="sm" className={cn('rounded-full px-4', onDark && 'bg-white text-slate-950 hover:bg-sky-50')}>
            <Link to="/demo">
              Launch demo <ArrowRight />
            </Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={cn('md:hidden', onDark && 'text-white hover:bg-white/10 hover:text-white')}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            className="overflow-hidden border-t md:hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="flex flex-col gap-1 px-6 py-4">
              {LINKS.map((l) => (
                <Link key={l.href} to={l.href} onClick={() => setOpen(false)} className="rounded-md py-2 text-sm text-muted-foreground hover:text-foreground">
                  {l.label}
                </Link>
              ))}
              <Button asChild className="mt-2 rounded-full">
                <Link to="/demo" onClick={() => setOpen(false)}>
                  Launch demo <ArrowRight />
                </Link>
              </Button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
