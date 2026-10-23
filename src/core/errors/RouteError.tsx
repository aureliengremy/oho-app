import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { Button } from '../ui/Button'
import { reportError } from './report'

/** Écran d'une erreur de rendu : le dit simplement, la signale, propose de recharger. */
export function RouteError() {
  const error = useRouteError()
  useEffect(() => reportError(error), [error])
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-ink">Quelque chose s’est cassé</h1>
      <p className="text-ink-2">L’erreur a été notée dans « État du système ». Recharger l’app règle le plus souvent le problème ; vos données ne sont pas touchées.</p>
      <Button onClick={() => window.location.reload()}>Recharger</Button>
    </main>
  )
}
