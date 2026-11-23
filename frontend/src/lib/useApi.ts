import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from './api'

export interface Resource<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/** Loads a GET endpoint and exposes loading, error and reload so every page can render all four states. */
export function useApi<T>(path: string | null): Resource<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (path === null) return
    let live = true
    setLoading(true)
    setError(null)
    api<T>(path)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : 'Something went wrong.'))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [path, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload }
}
