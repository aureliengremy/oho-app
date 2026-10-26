import { useEffect, useRef, useState } from 'react'

/** Distance (après amortissement de moitié) qui déclenche le rechargement. */
const THRESHOLD = 60

/**
 * Geste « tirer vers le bas » en haut de l'écran : au-delà du seuil, `onRefresh` part.
 * Renvoie la distance tirée, pour afficher un indicateur.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const [pull, setPull] = useState(0)
  const start = useRef<number | null>(null)
  const distance = useRef(0)
  const callback = useRef(onRefresh)
  useEffect(() => {
    callback.current = onRefresh
  })

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null
    }
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return
      distance.current = Math.max(0, Math.min(120, (e.touches[0].clientY - start.current) / 2))
      setPull(distance.current)
    }
    const onEnd = () => {
      if (start.current !== null && distance.current >= THRESHOLD) void callback.current()
      start.current = null
      distance.current = 0
      setPull(0)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  return { pull, ready: pull >= THRESHOLD }
}
