"use client"

import { useCallback, useRef, useState } from "react"

/** Keeps async controls pending through the network request, including React 18. */
export function useAsyncAction(onError: () => void) {
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const errorHandler = useRef(onError)
  errorHandler.current = onError
  const run = useCallback((action: () => Promise<unknown>) => {
    if (busy.current) return
    busy.current = true
    setPending(true)
    void action().catch(() => errorHandler.current()).finally(() => {
      busy.current = false
      setPending(false)
    })
  }, [])
  return [pending, run] as const
}
