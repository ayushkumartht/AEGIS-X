import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

const RELOAD_KEY = 'aegis:chunk-reload'

/** True for the errors a browser throws when a lazy page's file is gone (usually after a new deploy). */
export function isChunkLoadError(error: unknown) {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|Unable to preload CSS/i.test(msg)
}

/** Reload to pick up the new build, at most once a minute so it can never loop. */
export function reloadForNewBuild() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/**
 * Catches render errors in a page so the app never shows a blank white screen.
 * A missing lazy chunk triggers one reload; anything else shows what failed.
 */
export class RouteErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(prev: { resetKey: string }) {
    // moving to another page clears the error
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  componentDidCatch(error: Error) {
    console.error('Page crashed:', error)
    if (isChunkLoadError(error)) reloadForNewBuild()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const chunk = isChunkLoadError(error)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto size-8 text-amber-500" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">{chunk ? 'A newer version is available' : 'This page hit an error'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {chunk ? 'The app was updated while this tab was open. Reload to get the latest version.' : 'Reloading usually fixes it. If it keeps happening, share the message below.'}
          </p>
          {!chunk && <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-muted p-3 text-left text-xs whitespace-pre-wrap">{error.message}</pre>}
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
            >
              <RotateCw className="size-4" /> Reload
            </button>
            <a href="/" className="inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium hover:bg-muted">
              Home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
