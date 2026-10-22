import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'

/** Find a place in India and fly the map to it (OpenStreetMap Nominatim through the server's cache). */
export function PlaceSearch({ onPick }: { onPick: (hit: { lat: number; lon: number; label: string }) => void }) {
  const [q, setQ] = useState('')
  const search = useMutation({ mutationFn: () => api.opsSearch(q.trim()) })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (q.trim().length >= 2) search.mutate()
  }
  return (
    <form onSubmit={submit} className="relative flex gap-2" role="search">
      <input
        className="w-full min-w-0 rounded-lg border bg-background px-3 py-1.5 text-sm"
        placeholder="Find a place in India"
        aria-label="Find a place in India"
        value={q}
        maxLength={100}
        onChange={(e) => setQ(e.target.value)}
      />
      <Button type="submit" size="sm" variant="outline" disabled={search.isPending || q.trim().length < 2}>{search.isPending ? 'Searching' : 'Search'}</Button>
      {search.data && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-lg border bg-card text-sm shadow-lg">
          {search.data.length === 0 && <li className="px-3 py-2 text-muted-foreground">No place found.</li>}
          {search.data.map((h) => (
            <li key={`${h.lat},${h.lon}`}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-accent" onClick={() => { onPick({ lat: h.lat, lon: h.lon, label: h.name }); search.reset() }}>
                {h.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {search.isError && <p className="absolute left-0 top-full mt-1 text-xs text-risk" role="alert">{String(search.error.message)}</p>}
    </form>
  )
}
