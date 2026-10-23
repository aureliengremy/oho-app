import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * Bouton Retour d'Android : tant qu'une feuille ou une modale est ouverte, Retour la ferme
 * au lieu de quitter l'écran. On empile une entrée d'historique à l'ouverture et on la
 * consomme à la fermeture.
 */
export function useBackDismiss(open: boolean, onDismiss: () => void) {
  const dismissRef = useRef(onDismiss)
  useLayoutEffect(() => {
    dismissRef.current = onDismiss
  })

  useEffect(() => {
    if (!open) return
    const marker = { ohoSheet: Date.now() }
    window.history.pushState({ ...window.history.state, ...marker }, '')
    let closedByBack = false
    const onPop = () => {
      closedByBack = true
      dismissRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // Fermée autrement que par Retour : on retire l'entrée qu'on avait ajoutée.
      if (!closedByBack && window.history.state?.ohoSheet === marker.ohoSheet) window.history.back()
    }
  }, [open])
}
