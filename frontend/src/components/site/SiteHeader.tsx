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

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled || open ? 'border-b bg-background/80 backdrop-blur-xl' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" aria-label="AEGIS-X home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) =>
            l.href.startsWith('/#') ? (
              <Link key={l.href} to={l.href} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                {l.label}
              </Link>
            ) : (
              <NavLink
                key={l.href}
                to={l.href}
                className={({ isActive }) =>
                  cn('rounded-md px-3 py-2 text-sm transition-colors hover:text-foreground', isActive ? 'text-foreground' : 'text-muted-foreground')
                }
              >
                {l.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="hidden md:block">
          <Button asChild size="sm" className="rounded-full px-4">
            <Link to="/demo">
              Launch demo <ArrowRight />
            </Link>
          </Button>
        </div>

        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
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
