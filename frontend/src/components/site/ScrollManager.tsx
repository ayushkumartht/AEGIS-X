import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** React Router doesn't scroll on navigation: go to #hash targets, otherwise to the top. */
export function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 })
      return
    }
    // wait a frame so the target page has rendered
    const id = window.requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [pathname, hash])

  return null
}
