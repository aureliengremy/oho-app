import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Les écrans montent l'app complète (routes chargées à la demande) : sous charge, 1 s ne suffit
// pas toujours aux findBy, d'où des échecs au hasard. 4 s garde un échec rapide quand c'est réel.
configure({ asyncUtilTimeout: 4000 })

afterEach(() => cleanup())
