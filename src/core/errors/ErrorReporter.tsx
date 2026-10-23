import { useEffect } from 'react'
import { useClient } from '../client'
import { useHousehold } from '../household/HouseholdProvider'
import { createReporter, reportError, setReporter } from './report'

/** Écoute les erreurs non rattrapées de la page et les envoie au journal de l'espace. */
export function ErrorReporter() {
  const client = useClient()
  const { household } = useHousehold()

  useEffect(() => {
    setReporter(createReporter(client, household.id))
    const onError = (event: ErrorEvent) => reportError(event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      // Le rapporteur reste posé : l'écran d'erreur qui remplace l'app s'en sert encore.
    }
  }, [client, household.id])

  return null
}
